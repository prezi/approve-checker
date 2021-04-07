import * as OctokitTypes from "@octokit/types";
import * as Path from "path";
import { OctokitWrapper } from "./OctokitWrapper";

export enum OwnersKind {
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
export interface OwnersResult {
	owners: Owners;
	path: string;
}

interface OwnersData {
	owners: ReadonlyArray<string>;
	path: string;
}

const ownersfile = "OWNERS";

export class OwnersManager {
	private pathOwnersCache: Map<string, OwnersData>;
	public constructor(
		private octokit: OctokitWrapper,
	) {
		this.pathOwnersCache = new Map<string, OwnersData>();
	}

	public async collectOwners(path: string): Promise<OwnersResult> {
		const content = await this.getOwnersfileContent(path, path);
		if (content == null) {
			return {owners: {kind: OwnersKind.anyone}, path: "."};
		}

		if (content.owners.length === 0) {
			return {owners: {kind: OwnersKind.anyone}, path: Path.dirname(content.path)};
		}

		return {owners: {kind: OwnersKind.list, list: content.owners}, path: Path.dirname(content.path)};
	}

	private async getOwnersfileContent(path: string, origPath: string): Promise<OwnersData | null> {
		const dirname = Path.dirname(path);
		if (dirname == ".") {
			const content = await this.getFileContent(ownersfile, origPath);
			if (content === null) {
				this.saveListInCache(ownersfile, origPath, []);
			}
			return content;
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

	private async getFileContent(path: string, origPath: string): Promise<OwnersData | null> {
		const cachedValue = this.pathOwnersCache.get(path);
		if (cachedValue != null) {
			return cachedValue;
		}

		try {
			const ownersResponse: OctokitTypes.OctokitResponse<any> = await this.octokit.getFileContent(path);
			const buff = Buffer.from(ownersResponse.data.content, "base64");
			const list = buff.toString("ascii")
				.split("\n")
				.filter(line => line !== "" && !line.startsWith("#"))
			this.saveListInCache(path, origPath, list);
			return {owners: list, path};
		} catch (e) {
			return null;
		}
	}

	private saveListInCache(pathWherOwnersFound: string, origPath: string, list: ReadonlyArray<string>) {
		const dirname = Path.dirname(origPath);
		const ownersPath = dirname === "." ? ownersfile : dirname + "/" + ownersfile;
		this.pathOwnersCache.set(ownersPath, {owners: list, path: pathWherOwnersFound});
		if (pathWherOwnersFound !== ownersPath) {
			this.saveListInCache(pathWherOwnersFound, dirname, list);
		}
	}
}
