import * as core from "@actions/core";
import * as github from "@actions/github";
import { OctokitWrapper } from "./OctokitWrapper";
import {Owners, OwnersKind, OwnersManager} from "./OwnersManager";

async function collectApprovers(
	octokit: OctokitWrapper,
	headCommitSha: string,
): Promise<{approvers: Set<string>, rejecters: Set<string>}> {
	const reviews = await octokit.getReviews();
	const approvers = new Set<string>();
	const rejecters = new Set<string>();
	reviews.data.forEach(review => {
		const user = review.user;
		if (user != null) {
			const key = user.login;
			if (review.state === "APPROVED" && review.commit_id === headCommitSha) {
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

async function updateComment(
	octokit: OctokitWrapper,
	messageBody: string,
) {
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

export async function doApproverCheckLogic(octokit: OctokitWrapper, headCommitSha: string) {
	const ownersManager = new OwnersManager(octokit);

	const files = await octokit.getFiles();

	const moduleOwnersMap = new Map<string, Owners>();

	for (const r of files.data) {
		const result = await ownersManager.collectOwners(r.filename);
		moduleOwnersMap.set(result.path, result.owners);
	}

	const {approvers, rejecters} = await collectApprovers(octokit, headCommitSha);

	const requireApproveModules: Map<string, Owners> = new Map();
	moduleOwnersMap.forEach((value, key) => {
		if (value.kind === OwnersKind.list) {
			const missingApprover = value.list.every((owner) => !approvers.has(owner));
			const rejecterOfModule = value.list.filter(owner => rejecters.has(owner))

			if (missingApprover || rejecterOfModule.length > 0) {
				const needApprovalFrom: Owners = {kind: OwnersKind.list,  list: rejecterOfModule.length > 0 ? rejecterOfModule : value.list};
				requireApproveModules.set(key, needApprovalFrom);
			}
		} else {
			if (approvers.size === 0 || rejecters.size > 0) {
				const needApprovalFrom: Owners = rejecters.size > 0 ? {kind: OwnersKind.list, list: [...rejecters]} : {kind: OwnersKind.anyone}
				requireApproveModules.set(key, needApprovalFrom);
			}
		}
	});

	let comment = "";
	if (requireApproveModules.size > 0) {
		requireApproveModules.forEach((value, key) => {
			if (value != null) {
				comment += `- ${key}: ${value.kind === OwnersKind.list ? value.list : "anyone"}\n`;
			}
		});

		await octokit.updateStatus("failure");
	} else {
		await octokit.updateStatus("success");
		comment = "No more approvals are needed";
	}
	await updateComment(octokit, comment);
}

const run = async (): Promise<void> => {
	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const token = core.getInput("myToken");
		const headCommitSha = github.context.payload.pull_request != null ? github.context.payload.pull_request.head.sha : null;
		const octokit = new OctokitWrapper(owner, repo,prNum, headCommitSha, token);
		await doApproverCheckLogic(octokit, headCommitSha);

	} catch (error) {
		core.setFailed(error.message);
	}
};

run();
