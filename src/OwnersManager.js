"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnersManager = exports.OwnersKind = void 0;
const Path = __importStar(require("path"));
var OwnersKind;
(function (OwnersKind) {
    OwnersKind["anyone"] = "anyone";
    OwnersKind["list"] = "list";
})(OwnersKind = exports.OwnersKind || (exports.OwnersKind = {}));
const ownersfile = "OWNERS";
class OwnersManager {
    constructor(owner, repo, prNum, octokit) {
        this.owner = owner;
        this.repo = repo;
        this.prNum = prNum;
        this.octokit = octokit;
        console.log(this.prNum);
        this.pathOwnersCache = new Map();
    }
    async collectOwners(path) {
        const content = await this.getOwnersfileContent(path, path);
        if (content == null) {
            return { owners: { kind: OwnersKind.anyone }, path: "/" };
        }
        if (content.owners.length === 0) {
            return { owners: { kind: OwnersKind.anyone }, path: content.path };
        }
        return { owners: { kind: OwnersKind.list, list: content.owners }, path: content.path };
    }
    async getOwnersfileContent(path, origPath) {
        const dirname = Path.dirname(path);
        if (dirname == ".") {
            const content = await this.getFileContent(ownersfile, origPath);
            if (content === null) {
                this.saveListInCache(ownersfile, origPath, []);
            }
            return content;
        }
        else {
            const ownersfilepath = dirname + "/" + ownersfile;
            const content = await this.getFileContent(ownersfilepath, origPath);
            if (content != null) {
                return content;
            }
            else {
                return await this.getOwnersfileContent(dirname, origPath);
            }
        }
    }
    async getFileContent(path, origPath) {
        const cachedValue = this.pathOwnersCache.get(path);
        if (cachedValue != null) {
            return cachedValue;
        }
        try {
            const ownersResponse = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                owner: this.owner,
                repo: this.repo,
                path: path,
            });
            const buff = Buffer.from(ownersResponse.data.content, "base64");
            const list = buff.toString("ascii").split("\n");
            this.saveListInCache(path, origPath, list);
            return { owners: list, path };
        }
        catch (e) {
            return null;
        }
    }
    saveListInCache(pathWherOwnersFound, origPath, list) {
        const dirname = Path.dirname(origPath);
        const ownersPath = dirname === "." ? ownersfile : dirname + "/" + ownersfile;
        this.pathOwnersCache.set(ownersPath, { owners: list, path: pathWherOwnersFound });
        if (pathWherOwnersFound !== ownersPath) {
            this.saveListInCache(pathWherOwnersFound, dirname, list);
        }
    }
}
exports.OwnersManager = OwnersManager;
;
