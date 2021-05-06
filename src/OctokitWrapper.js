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
exports.OctokitWrapper = void 0;
const github = __importStar(require("@actions/github"));
class OctokitWrapper {
    constructor(owner, repo, prNum, headCommitSha, baseRef, token) {
        this.owner = owner;
        this.repo = repo;
        this.prNum = prNum;
        this.headCommitSha = headCommitSha;
        this.baseRef = baseRef;
        this.octokit = github.getOctokit(token);
    }
    getReviews() {
        return this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
            owner: this.owner,
            repo: this.repo,
            pull_number: +this.prNum,
        });
    }
    getComments() {
        return this.octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
            owner: this.owner,
            repo: this.repo,
            issue_number: +this.prNum,
        });
    }
    getCommits() {
        return this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
            owner: this.owner,
            repo: this.repo,
            pull_number: +this.prNum,
        });
    }
    updateComment(commentId, message) {
        return this.octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
            owner: this.owner,
            repo: this.repo,
            comment_id: commentId,
            body: message,
        });
    }
    addComment(message) {
        return this.octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
            owner: this.owner,
            repo: this.repo,
            issue_number: +this.prNum,
            body: message,
        });
    }
    async getFiles() {
        let pageIdx = 1;
        let part = await this.getFilePage(pageIdx);
        let result = [];
        while (part.data.lenght !== 0) {
            result = [...result, ...part.data];
            ++pageIdx;
            part = await this.getFilePage(pageIdx);
        }
        return result;
    }
    getFilePage(pageIdx) {
        return this.octokit.request("GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files", {
            owner: this.owner,
            repo: this.repo,
            pull_number: this.prNum,
            page: pageIdx,
        });
    }
    getFileContent(path) {
        return this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner: this.owner,
            repo: this.repo,
            path: path,
            ref: this.baseRef,
        });
    }
    updateStatus(state) {
        return this.octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
            owner: this.owner,
            repo: this.repo,
            sha: this.headCommitSha,
            state: state,
            context: "code change manager",
        });
    }
}
exports.OctokitWrapper = OctokitWrapper;
