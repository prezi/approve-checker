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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
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
        console.log("xxx collect owners: ", path);
        const content = await this.getOwnersfileContent(path, path);
        if (content == null || content.length === 0) {
            return { kind: OwnersKind.anyone };
        }
        return { kind: OwnersKind.list, list: content };
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
        console.log("xxx get file content: ", path);
        const cachedValue = this.pathOwnersCache.get(path);
        if (cachedValue != null) {
            console.log("Found in cache:", path);
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
            return list;
        }
        catch (e) {
            return null;
        }
    }
    saveListInCache(pathWherOwnersFound, origPath, list) {
        const dirname = Path.dirname(origPath);
        const ownersPath = dirname === "." ? ownersfile : dirname + "/" + ownersfile;
        console.log("save in cache: ", ownersPath);
        this.pathOwnersCache.set(ownersPath, list);
        if (pathWherOwnersFound !== ownersPath) {
            this.saveListInCache(pathWherOwnersFound, dirname, list);
        }
    }
}
exports.OwnersManager = OwnersManager;
;
const run = async () => {
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
        const response = await octokit.request("GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files", {
            owner: owner,
            repo: repo,
            pull_number: prNum,
        });
        for (const r of response.data) {
            const owners = await ownersManager.collectOwners(r.filename);
            console.log("-", r.filename, ": ", owners);
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
};
run();
