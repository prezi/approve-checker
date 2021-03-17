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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const OwnersManager_1 = require("./OwnersManager");
const run = async () => {
    // core.debug("Hello World");
    // console.log({payload: github.context.payload});
    console.log("Start action");
    try {
        const [owner, repo] = core.getInput("repository").split("/");
        const prNum = core.getInput("pr-number");
        const myToken = core.getInput("myToken");
        const octokit = github.getOctokit(myToken);
        const ownersManager = new OwnersManager_1.OwnersManager(owner, repo, prNum, octokit);
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
