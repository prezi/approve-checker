import * as core from "@actions/core";
import * as github from "@actions/github";
import {GitHub} from "@actions/github/lib/utils";
import {Owners, OwnersKind, OwnersManager} from "./OwnersManager";

async function collectApprovers(
	owner: string,
	repo: string,
	prNum: string,
	octokit: InstanceType<typeof GitHub>,
): Promise<ReadonlyArray<string>> {
	const reviews = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
		owner: owner,
		repo: repo,
		pull_number: +prNum,
	});

	return reviews.data
		.filter((review) => review.state === "APPROVED")
		.map((review) => (review.user != null ? review.user.login : null))
		.filter((res) => res != null) as ReadonlyArray<string>;
	/*
	const emails = await Promise.all(
		reviews.data
			.filter(review => review.state === "APPROVED")
			.map(async (review) => {
				const username = review.user != null ? review.user.login : null;
				console.log("xxx finding email: ", username);
				if (username == null) {
					return Promise.resolve(null);
				}

				const user = await octokit.request("GET /users/{username}", {
					username: username,
				});

				console.log("xxx email found: ", user.data.email);
				return Promise.resolve(user.data.email);
			}),
	);

	return emails.filter((e) => e != null) as ReadonlyArray<string>;
	*/
}

async function updateComment(
	owner: string,
	repo: string,
	prNum: string,
	octokit: InstanceType<typeof GitHub>,
	messageBody: string,
) {
	const messageHead = "Approvals in the following modules are missing:";
	const newMessage = messageHead + "\n" + messageBody;

	const comments = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
		owner: owner,
		repo: repo,
		issue_number: +prNum,
	});

	const ownerComment = comments.data.find((m) => m.body != null && m.body.startsWith(messageHead));
	if (ownerComment != null) {
		await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
			owner: owner,
			repo: repo,
			comment_id: ownerComment.id,
			body: newMessage,
		});
	} else {
		await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner: owner,
			repo: repo,
			issue_number: +prNum,
			body: newMessage,
		});
	}
}

const run = async (): Promise<void> => {
	// core.debug("Hello World");
	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const myToken = core.getInput("myToken");
		const octokit = github.getOctokit(myToken);
		const ownersManager = new OwnersManager(owner, repo, prNum, octokit);
		const headCommitSha =
			github.context.payload.pull_request != null ? github.context.payload.pull_request.head.sha : null;

		const response = await octokit.request(
			"GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files",
			{
				owner: owner,
				repo: repo,
				pull_number: prNum,
			},
		);

		const moduleOwnersMap = new Map<string, Owners>();

		for (const r of response.data) {
			const result = await ownersManager.collectOwners(r.filename);
			moduleOwnersMap.set(result.path, result.owners);
		}

		const approvers = await collectApprovers(owner, repo, prNum, octokit);

		const requireApproveModules: string[] = [];
		moduleOwnersMap.forEach((value, key) => {
			if (value.kind === OwnersKind.list && value.list.every((owner) => approvers.indexOf(owner) === -1)) {
				requireApproveModules.push(key);
			}
		});

		if (requireApproveModules.length > 0) {
			let comment = "";
			requireApproveModules.forEach((key) => {
				const value = moduleOwnersMap.get(key);
				if (value != null) {
					comment += `- ${key}: ${value.kind === OwnersKind.list ? value.list : "anyone"}\n`;
				}
			});

			await octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
				owner: owner,
				repo: repo,
				sha: headCommitSha,
				state: "pending",
			});

			await updateComment(owner, repo, prNum, octokit, comment);
		} else {
			await octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
				owner: owner,
				repo: repo,
				sha: headCommitSha,
				state: "success",
			});
		}
	} catch (error) {
		core.setFailed(error.message);
	}
};

run();
