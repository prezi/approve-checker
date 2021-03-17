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

const ownersfile = "OWNERS";

class OwnersManager {
	private pathOwnersCache: Map<string, ReadonlyArray<string>>;
	public constructor(
		private owner: string,
		private repo: string,
		private prNum: string,
		private octokit: InstanceType<typeof GitHub>
	) {
		console.log(this.prNum);
		this.pathOwnersCache = new Map<string, ReadonlyArray<string>>();
	}

	public async collectOwners(path: string): Promise<Owners> {
		const content = await this.getOwnersfileContent(path, path);
		if (content == null) {
			return {kind: OwnersKind.anyone};
		}
		return {kind: OwnersKind.list, list: content};
	}

	private async getOwnersfileContent(path: string, origPath: string): Promise<ReadonlyArray<string> | null> {
		const dirname = Path.dirname(path);
		if (dirname == ".") {
			return await this.getFileContent(ownersfile, origPath);
		} else {
			const ownersfilepath = dirname + "/" + ownersfile;
			const content = await this.getFileContent(ownersfilepath, origPath);

			if (content != null) {
				return content;
			} else {
				return await this.getOwnersfileContent(dirname, origPath);
			}
		}
	}

	private async getFileContent(path: string, origPath: string): Promise<ReadonlyArray<string> | null> {
		const cachedValue = this.pathOwnersCache.get(path);
		if (cachedValue != null) {
			console.log("Found in cache:", path);
			return cachedValue;
		}

		try {
			const ownersResponse: OctokitTypes.OctokitResponse<any> = await this.octokit.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{
					owner: this.owner,
					repo: this.repo,
					path: path,
				},
			);

			const buff = Buffer.from(ownersResponse.data.content, "base64");
			const list = buff.toString("ascii").split("\n");
			this.saveListInCache(path, origPath, list);
			return list;
		} catch (e) {
			return null;
		}
	}

	private saveListInCache(pathWherOwnersFound: string, origPath: string, list: ReadonlyArray<string>) {
		const dirname = Path.dirname(origPath);
		const ownersPath = dirname === "." ? ownersfile : dirname + "/" + ownersfile;
		console.log("save in cache: ", ownersPath)
		this.pathOwnersCache.set(ownersPath, list)
		if (pathWherOwnersFound !== ownersPath) {
			this.saveListInCache(pathWherOwnersFound, dirname, list);
		}
	}

};

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

		for (const r of response.data) {
			const owners = await ownersManager.collectOwners(r.filename);
			console.log("-", r.filename, ": ", owners);
		}
	} catch (error) {
		core.setFailed(error.message);
	}
};



run();

export default run;
