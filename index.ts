import * as core from "@actions/core";
import * as github from "@actions/github";
import * as OctokitTypes from "@octokit/types";

enum OwnersKind {
	anyone = "anyone",
	list = "list"
};

interface OwnersBase {
	kind: OwnersKind;
}

interface OwnersAnyone extends OwnersBase {
	kind: OwnersKind.anyone;
}

interface OwnersList extends OwnersBase {
	kind: OwnersKind.list;
	list: ReadonlyArray<string>;
}

export type Owners = OwnersAnyone | OwnersList;

const run = async (): Promise<void> => {
	// core.debug("Hello World");
	// console.log({payload: github.context.payload});

	console.log("Start action")
	try {
		const [owner, repo] = core.getInput('repository').split("/");
		const prNum = core.getInput('pr-number');
		const myToken = core.getInput('myToken');
		const octokit = github.getOctokit(myToken);
		console.log(`data ${repo}, ${prNum}`);

		const response = await octokit.request('GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files', {
			owner: owner,
			repo: repo,
			pull_number: prNum
		})

		for (const r of response.data) {
			console.log("-", r.filename);
		}

		try {
			const ownersResponse: OctokitTypes.OctokitResponse<any> = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
				owner: owner,
				repo: repo,
				path: 'module_a/OWNERSss'
			});

			const buff = Buffer.from(ownersResponse.data.content, 'base64');
			const content = buff.toString('ascii');
			console.log("Content: ", content);
		} catch (e) {
			console.log("error: ", e)
		}



	} catch (error) {
		core.setFailed(error.message);
	}
};

// async function collectOwners(path: string): Promise<Owners> {
// 	return [];
// }

// async function getOwnersfileContent(path: string): string | null {
// 	if
// }

run();

export default run;
