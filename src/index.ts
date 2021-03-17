import * as core from "@actions/core";
import * as github from "@actions/github";
import { Owners, OwnersKind, OwnersManager } from "./OwnersManager"


const run = async (): Promise<void> => {
	// core.debug("Hello World");
	// console.log({payload: github.context.payload});

	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const myToken = core.getInput("myToken");
		const octokit = github.getOctokit(myToken);
		const ownersManager = new OwnersManager(owner, repo, prNum, octokit);
		console.log(`data ${repo}, ${prNum}`);

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
			moduleOwnersMap.set(result.path, result.owners)
			console.log("-", r.filename, ": ", result.owners.kind === OwnersKind.list ? result.owners.list : "anyone");
		}

		console.log("module owners map: ")
		moduleOwnersMap.forEach((value, key) => {
			console.log(key, value.kind === OwnersKind.list ? value.list : "anyone");
		})
	} catch (error) {
		core.setFailed(error.message);
	}
};



run();

