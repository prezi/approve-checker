import * as core from "@actions/core";
import * as github from "@actions/github";
import {GitHub} from "@actions/github/lib/utils";
import {Owners, OwnersKind, OwnersManager} from "./OwnersManager";

async function collectApprovers(
	owner: string,
	repo: string,
	prNum: string,
	octokit: InstanceType<typeof GitHub>,
): Promise<{approvers: Set<string>, rejecters: Set<string>}> {
	const reviews = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
		owner: owner,
		repo: repo,
		pull_number: +prNum,
	});

	const approvers = new Set<string>();
	const rejecters = new Set<string>();
	reviews.data.forEach(review => {
		const user = review.user;
		console.log("xxx state: ", review.state)
		if (user != null) {
			const key = user.login;
			if (review.state === "APPROVED") {
				console.log("xxx add approver", key)
				approvers.add(key);
				rejecters.delete(key);

			} else if (review.state === "REQUEST_CHANGES") {
				console.log("xxx add rejecter", key)
				approvers.delete(key);
				rejecters.add(key);
			}
		}
	});

	return {approvers, rejecters};

	/*const query = `{
		organization(login: "prezi") {
		  samlIdentityProvider {
			externalIdentities(first: 100) {
			  edges {
				node {
				  samlIdentity {
					nameId
				  }
				  user {
					login
				  }
				}
			  }
			  pageInfo {
				hasNextPage,
				endCursor
			  }
			}
		  }
		}
	}`;

	const gres = await octokit.graphql(query);
	console.log("xxx gres", gres);
	*/


	/*const emails = await Promise.all(
		reviews.data
			// .filter(review => review.state === "APPROVED")
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


	console.log("xxx emails: ", emails);

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

		const {approvers, rejecters} = await collectApprovers(owner, repo, prNum, octokit);

		console.log("xxx approvers: ", [...approvers])
		console.log("xxx rejectes: ", [...rejecters])
		const requireApproveModules: string[] = [];
		moduleOwnersMap.forEach((value, key) => {
			if (value.kind === OwnersKind.list && value.list.every((owner) => !approvers.has(owner))) {
				requireApproveModules.push(key);
			}
		});

		let comment = "";
		if (requireApproveModules.length > 0 || rejecters.size > 0) {
			requireApproveModules.forEach((key) => {
				const value = moduleOwnersMap.get(key);
				if (value != null) {
					comment += `- ${key}: ${value.kind === OwnersKind.list ? value.list : "anyone"}\n`;
				}
			});

			if (rejecters.size > 0) {
				comment += "\n\n requested changes: " + [...rejecters];
			}

			await octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
				owner: owner,
				repo: repo,
				sha: headCommitSha,
				state: "pending",
			});
		} else {
			await octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
				owner: owner,
				repo: repo,
				sha: headCommitSha,
				state: "success",
			});
			comment = "\n\n No more approvals are needed";
		}
		await updateComment(owner, repo, prNum, octokit, comment);
	} catch (error) {
		core.setFailed(error.message);
	}
};

run();
