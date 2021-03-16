import * as core from "@actions/core";
import * as github from "@actions/github";
import {GitHub} from "@actions/github/lib/utils";
import * as OctokitTypes from "@octokit/types";
import * as Path from "path";

enum OwnersKind {
	anyone = "anyone",
	list = "list",
}

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

interface Context {
	owner: string;
	repo: string;
	prNum: string;
	octokit: InstanceType<typeof GitHub>;
}

const ownersfile = "OWNERSFILE";

const run = async (): Promise<void> => {
	// core.debug("Hello World");
	// console.log({payload: github.context.payload});

	console.log("Start action");
	try {
		const [owner, repo] = core.getInput("repository").split("/");
		const prNum = core.getInput("pr-number");
		const myToken = core.getInput("myToken");
		const octokit = github.getOctokit(myToken);
		console.log(`data ${repo}, ${prNum}`);

		const response = await octokit.request(
			"GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files",
			{
				owner: owner,
				repo: repo,
				pull_number: prNum,
			},
		);

		for (const r of response.data) {
			const owners = await collectOwners(r.filename, {owner, repo, prNum, octokit});
			console.log("-", r.filename, ": ", owners);
		}
	} catch (error) {
		core.setFailed(error.message);
	}
};

async function collectOwners(path: string, ctx: Context): Promise<Owners> {
	const content = await getOwnersfileContent(path, ctx);
	if (content == null) {
		return {kind: OwnersKind.anyone};
	}
	const buff = Buffer.from(content, "base64");
	const list = buff.toString("ascii").split("\n");
	return {kind: OwnersKind.list, list};
}

async function getOwnersfileContent(path: string, ctx: Context): Promise<string | null> {
	const dirname = Path.dirname(path);
	if (dirname == ".") {
		return await getFileContent(ownersfile, ctx);
	} else {
		const ownersfilepath = dirname + "/" + ownersfile;
		const content = await getFileContent(ownersfilepath, ctx);

		if (content != null) {
			return content;
		} else {
			return await getOwnersfileContent(dirname, ctx);
		}
	}
}

async function getFileContent(path: string, ctx: Context): Promise<string | null> {
	try {
		const ownersResponse: OctokitTypes.OctokitResponse<any> = await ctx.octokit.request(
			"GET /repos/{owner}/{repo}/contents/{path}",
			{
				owner: ctx.owner,
				repo: ctx.repo,
				path: path,
			},
		);

		return ownersResponse.data.content;
	} catch (e) {
		return null;
	}
}

run();

export default run;
