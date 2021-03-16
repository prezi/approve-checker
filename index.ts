import * as core from "@actions/core";
import * as github from "@actions/github";
import * as OctokitTypes from "@octokit/types";


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

		const ownersResponse: OctokitTypes.OctokitResponse<any> = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
			owner: owner,
			repo: repo,
			path: 'module_a/OWNERS'
		});

		// console.log("ownersResponse: ", ownersResponse)
		const buff = Buffer.from(ownersResponse.data.content, 'base64');
		const content = buff.toString('ascii');
		console.log("Content: ", content);


	} catch (error) {
		core.setFailed(error.message);
	}
};

run();

export default run;
