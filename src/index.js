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
exports.doApproverCheckLogic = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const OctokitWrapper_1 = require("./OctokitWrapper");
const OwnersManager_1 = require("./OwnersManager");
async function collectApprovers(octokit) {
    const reviews = await octokit.getReviews();
    const approvers = new Set();
    const rejecters = new Set();
    reviews.data.forEach(review => {
        const user = review.user;
        if (user != null) {
            const key = user.login;
            if (review.state === "APPROVED") {
                approvers.add(key);
                rejecters.delete(key);
            }
            else if (review.state === "CHANGES_REQUESTED") {
                approvers.delete(key);
                rejecters.add(key);
            }
        }
    });
    return { approvers, rejecters };
}
async function updateComment(octokit, messageBody) {
    const messageHead = "Approvals in the following modules are missing:";
    const newMessage = messageHead + "\n\n" + messageBody;
    const comments = await octokit.getComments();
    const ownerComment = comments.data.find((m) => m.body != null && m.body.startsWith(messageHead));
    if (ownerComment != null) {
        await octokit.updateComment(ownerComment.id, newMessage);
    }
    else {
        await octokit.addComment(newMessage);
    }
}
async function doApproverCheckLogic(octokit) {
    const ownersManager = new OwnersManager_1.OwnersManager(octokit);
    const files = await octokit.getFiles();
    const moduleOwnersMap = new Map();
    for (const r of files.data) {
        const result = await ownersManager.collectOwners(r.filename);
        moduleOwnersMap.set(result.path, result.owners);
    }
    const { approvers, rejecters } = await collectApprovers(octokit);
    const requireApproveModules = new Map();
    moduleOwnersMap.forEach((value, key) => {
        if (value.kind === OwnersManager_1.OwnersKind.list) {
            const missingApprover = value.list.every((owner) => !approvers.has(owner));
            const rejecterOfModule = value.list.filter(owner => rejecters.has(owner));
            if (missingApprover || rejecterOfModule.length > 0) {
                const needApprovalFrom = { kind: OwnersManager_1.OwnersKind.list, list: rejecterOfModule.length > 0 ? rejecterOfModule : value.list };
                requireApproveModules.set(key, needApprovalFrom);
            }
        }
        else {
            if (approvers.size === 0 || rejecters.size > 0) {
                const needApprovalFrom = rejecters.size > 0 ? { kind: OwnersManager_1.OwnersKind.list, list: [...rejecters] } : { kind: OwnersManager_1.OwnersKind.anyone };
                requireApproveModules.set(key, needApprovalFrom);
            }
        }
    });
    let comment = "";
    if (requireApproveModules.size > 0) {
        requireApproveModules.forEach((value, key) => {
            if (value != null) {
                comment += `- ${key}: ${value.kind === OwnersManager_1.OwnersKind.list ? value.list : "anyone"}\n`;
            }
        });
        await octokit.updateStatus("failure");
    }
    else {
        await octokit.updateStatus("success");
        comment = "No more approvals are needed";
    }
    await updateComment(octokit, comment);
}
exports.doApproverCheckLogic = doApproverCheckLogic;
const run = async () => {
    console.log("Start action");
    try {
        const [owner, repo] = core.getInput("repository").split("/");
        const prNum = core.getInput("pr-number");
        const token = core.getInput("myToken");
        const headCommitSha = github.context.payload.pull_request != null ? github.context.payload.pull_request.head.sha : null;
        const octokit = new OctokitWrapper_1.OctokitWrapper(owner, repo, prNum, headCommitSha, token);
        await doApproverCheckLogic(octokit);
    }
    catch (error) {
        core.setFailed(error.message);
    }
};
run();
