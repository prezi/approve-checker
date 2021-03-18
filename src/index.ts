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

	const emails = await Promise.all(
		reviews.data.map(async (review) => {
			const username = review.user?.login;
			if (username == null) {
				return Promise.resolve(null);
			}

			const user = await octokit.request("GET /users/{username}", {
				username: username,
			});

			return Promise.resolve(user.data.email);
		}),
	);

	return emails.filter((e) => e != null) as ReadonlyArray<string>;
}

const run = async (): Promise<void> => {
	// core.debug("Hello World");
	// console.log({payload: github.context.payload});

	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const ref = core.getInput("ref");
		const myToken = core.getInput("myToken");
		const octokit = github.getOctokit(myToken);
		const ownersManager = new OwnersManager(owner, repo, prNum, octokit);
		console.log(`data ${repo}, ${prNum}, ${ref}`);

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
			console.log("-", r.filename, ": ", result.owners.kind === OwnersKind.list ? result.owners.list : "anyone");
		}

		const approvers = await collectApprovers(owner, repo, prNum, octokit);

		const requireApproveModules: string[] = [];
		moduleOwnersMap.forEach((value, key) => {
			if (value.kind === OwnersKind.list && value.list.every((owner) => approvers.indexOf(owner) === -1)) {
				requireApproveModules.push(key);
			}
		});

		let comment = "";
		requireApproveModules.forEach((key) => {
			const value = moduleOwnersMap.get(key);
			if (value != null) {
				comment += `- ${key}: ${value.kind === OwnersKind.list ? value.list : "anyone"}\n`;
			}
		});

		await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner: owner,
			repo: repo,
			issue_number: +prNum,
			body: comment,
		});
	} catch (error) {
		core.setFailed(error.message);
	}
};

run();
