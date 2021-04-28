import * as core from "@actions/core";
import * as github from "@actions/github";
import {CommentFormatter, PathUserData, TableCommentFormatter} from "./CommentFormatter";
import {OctokitWrapper} from "./OctokitWrapper";
import {Owners, OwnersKind, OwnersManager} from "./OwnersManager";

async function collectApprovers(
	octokit: OctokitWrapper,
	headCommitSha: string,
): Promise<{approvers: Set<string>; rejecters: Set<string>}> {
	const reviews = await octokit.getReviews();
	const approvers = new Set<string>();
	const rejecters = new Set<string>();
	reviews.data.forEach((review) => {
		const user = review.user;
		if (user != null) {
			const key = user.login;
			if (
				review.commit_id === headCommitSha &&
				(review.state === "APPROVED" ||
					(review.state === "COMMENTED" && review.body.toLowerCase().startsWith("approved")))
			) {
				approvers.add(key);
				rejecters.delete(key);
			} else if (review.state === "CHANGES_REQUESTED") {
				approvers.delete(key);
				rejecters.add(key);
			}
		}
	});

	return {approvers, rejecters};
}

async function updateComment(octokit: OctokitWrapper, messageBody: string) {
	const messageHead = "Approvals in the following modules are missing:";
	const newMessage = messageHead + "\n\n" + messageBody;

	const comments = await octokit.getComments();
	const ownerComment = comments.data.find((m) => m.body != null && m.body.startsWith(messageHead));
	if (ownerComment != null) {
		await octokit.updateComment(ownerComment.id, newMessage);
	} else {
		await octokit.addComment(newMessage);
	}
}

async function collectCommitters(octokit: OctokitWrapper): Promise<Set<string>> {
	const commits = await octokit.getCommits();
	const committers = new Set<string>();
	commits.data.forEach((commit) => {
		if (commit.author != null) {
			committers.add(commit.author.login);
		}
	});

	return committers;
}

enum ApproveState {
	approved = "approved",
	oneCommitter = "oneCommitter",
	noApprove = "noApprove",
}

export function calculateRequireApprovePerModules(
	approvers: Set<string>,
	rejecters: Set<string>,
	committers: Set<string>,
	moduleOwnersMap: Map<string, Owners>,
): Map<string, Owners> {
	const requireApproveModules: Map<string, Owners> = new Map();

	moduleOwnersMap.forEach((value, key) => {
		if (value.kind === OwnersKind.list) {
			const approversOfModule = value.list.filter((owner) => approvers.has(owner));
			const nonCommiterApproversOfModule = approversOfModule.filter((a) => !committers.has(a));
			const rejecterOfModule = value.list.filter((owner) => rejecters.has(owner));

			let approveState: ApproveState;
			let needMoreApprove = false;
			if (nonCommiterApproversOfModule.length > 0 || approversOfModule.length > 1) {
				approveState = ApproveState.approved;
			} else if (approversOfModule.length === 0) {
				approveState = ApproveState.noApprove;
			} else {
				approveState = ApproveState.oneCommitter;
			}

			let requireApproval: ReadonlyArray<string> = [];
			if (approveState === ApproveState.noApprove) {
				needMoreApprove = true;
				requireApproval = value.list;
			} else if (approveState === ApproveState.oneCommitter) {
				needMoreApprove = true;
				requireApproval = value.list.filter((v) => v !== approversOfModule[0]);
			}

			if (rejecterOfModule.length > 0) {
				needMoreApprove = true;
				if (rejecterOfModule.length === 1 && committers.has(rejecterOfModule[0])) {
					if (approveState === ApproveState.oneCommitter && approversOfModule[0] !== rejecterOfModule[0]) {
						requireApproval = rejecterOfModule;
					} else {
						requireApproval = [
							...requireApproval.filter((v) => v !== rejecterOfModule[0]),
							rejecterOfModule[0],
						];
					}
				} else {
					requireApproval = rejecterOfModule;
				}
			}

			if (needMoreApprove) {
				requireApproveModules.set(
					key,
					requireApproval.length > 0
						? {kind: OwnersKind.list, list: requireApproval}
						: {kind: OwnersKind.anyone},
				);
			}
		} else if (value.kind === OwnersKind.anyone) {
			if (rejecters.size > 0) {
				requireApproveModules.set(key, {kind: OwnersKind.list, list: [...rejecters]});
			} else if (approvers.size < 2) {
				if (approvers.size === 0 || (approvers.size === 1 && committers.has([...approvers][0]))) {
					requireApproveModules.set(key, {kind: OwnersKind.anyone});
				}
			}
		}
	});

	return requireApproveModules;
}

export async function doApproverCheckLogic(
	octokit: OctokitWrapper,
	headCommitSha: string,
	commentFormatter: CommentFormatter,
): Promise<"failure" | "success"> {
	const ownersManager = new OwnersManager(octokit);

	const files = await octokit.getFiles();

	const moduleOwnersMap = new Map<string, Owners>();

	for (const r of files.data) {
		const result = await ownersManager.collectOwners(r.filename);
		moduleOwnersMap.set(result.path, result.owners);
	}

	const {approvers, rejecters} = await collectApprovers(octokit, headCommitSha);
	const committers = await collectCommitters(octokit);

	const requireApproveModules = calculateRequireApprovePerModules(approvers, rejecters, committers, moduleOwnersMap);

	let comment = "";
	let status: "failure" | "success";
	if (requireApproveModules.size > 0) {
		const pathUserData: PathUserData[] = [];
		requireApproveModules.forEach((value, key) => {
			if (value != null) {
				pathUserData.push({path: key, users: value.kind === OwnersKind.list ? value.list : ["anyone"]});
			}
		});
		comment = commentFormatter.format(pathUserData);

		status = "failure";
		await octokit.updateStatus(status);
	} else {
		status = "success";
		await octokit.updateStatus(status);
		comment = "No more approvals are needed";
	}
	await updateComment(octokit, comment);
	return status;
}

const run = async (): Promise<void> => {
	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const token = core.getInput("myToken");
		const headCommitSha =
			github.context.payload.pull_request != null ? github.context.payload.pull_request.head.sha : null;
		const baseRef =
			github.context.payload.pull_request != null ? github.context.payload.pull_request.base.ref : null;
		const octokit = new OctokitWrapper(owner, repo, prNum, headCommitSha, baseRef, token);
		await doApproverCheckLogic(octokit, headCommitSha, new TableCommentFormatter());
	} catch (error) {
		core.setFailed(error.message);
	}
};

run();
