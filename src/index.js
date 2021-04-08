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
exports.doApproverCheckLogic = exports.calculateRequireApprovePerModules = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const CommentFormatter_1 = require("./CommentFormatter");
const OctokitWrapper_1 = require("./OctokitWrapper");
const OwnersManager_1 = require("./OwnersManager");
async function collectApprovers(octokit, headCommitSha) {
    const reviews = await octokit.getReviews();
    const approvers = new Set();
    const rejecters = new Set();
    reviews.data.forEach((review) => {
        const user = review.user;
        if (user != null) {
            const key = user.login;
            if (review.commit_id === headCommitSha &&
                (review.state === "APPROVED" ||
                    (review.state === "COMMENTED" && review.body.toLowerCase().startsWith("approved")))) {
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
async function collectCommitters(octokit) {
    const commits = await octokit.getCommits();
    const committers = new Set();
    commits.data.forEach((commit) => {
        if (commit.author != null) {
            committers.add(commit.author.login);
        }
    });
    return committers;
}
var ApproveState;
(function (ApproveState) {
    ApproveState["approved"] = "approved";
    ApproveState["oneCommitter"] = "oneCommitter";
    ApproveState["noApprove"] = "noApprove";
})(ApproveState || (ApproveState = {}));
function calculateRequireApprovePerModules(approvers, rejecters, committers, moduleOwnersMap) {
    const requireApproveModules = new Map();
    moduleOwnersMap.forEach((value, key) => {
        if (value.kind === OwnersManager_1.OwnersKind.list) {
            const approversOfModule = value.list.filter((owner) => approvers.has(owner));
            const nonCommiterApproversOfModule = approversOfModule.filter((a) => !committers.has(a));
            const rejecterOfModule = value.list.filter((owner) => rejecters.has(owner));
            let approveState;
            let needMoreApprove = false;
            if (nonCommiterApproversOfModule.length > 0 || approversOfModule.length > 1) {
                approveState = ApproveState.approved;
            }
            else if (approversOfModule.length === 0) {
                approveState = ApproveState.noApprove;
            }
            else {
                approveState = ApproveState.oneCommitter;
            }
            let requireApproval = [];
            if (approveState === ApproveState.noApprove) {
                needMoreApprove = true;
                requireApproval = value.list;
            }
            else if (approveState === ApproveState.oneCommitter) {
                needMoreApprove = true;
                requireApproval = value.list.filter((v) => v !== approversOfModule[0]);
            }
            if (rejecterOfModule.length > 0) {
                needMoreApprove = true;
                if (rejecterOfModule.length === 1 && committers.has(rejecterOfModule[0])) {
                    if (approveState === ApproveState.oneCommitter && approversOfModule[0] !== rejecterOfModule[0]) {
                        requireApproval = rejecterOfModule;
                    }
                    else {
                        requireApproval = [
                            ...requireApproval.filter((v) => v !== rejecterOfModule[0]),
                            rejecterOfModule[0],
                        ];
                    }
                }
                else {
                    requireApproval = rejecterOfModule;
                }
            }
            if (needMoreApprove) {
                requireApproveModules.set(key, requireApproval.length > 0
                    ? { kind: OwnersManager_1.OwnersKind.list, list: requireApproval }
                    : { kind: OwnersManager_1.OwnersKind.anyone });
            }
        }
        else if (value.kind === OwnersManager_1.OwnersKind.anyone) {
            if (rejecters.size > 0) {
                requireApproveModules.set(key, { kind: OwnersManager_1.OwnersKind.list, list: [...rejecters] });
            }
            else if (approvers.size < 2) {
                if (approvers.size === 0 || (approvers.size === 1 && committers.has([...approvers][0]))) {
                    requireApproveModules.set(key, { kind: OwnersManager_1.OwnersKind.anyone });
                }
            }
        }
    });
    return requireApproveModules;
}
exports.calculateRequireApprovePerModules = calculateRequireApprovePerModules;
async function doApproverCheckLogic(octokit, headCommitSha, commentFormatter) {
    const ownersManager = new OwnersManager_1.OwnersManager(octokit);
    const files = await octokit.getFiles();
    const moduleOwnersMap = new Map();
    for (const r of files.data) {
        const result = await ownersManager.collectOwners(r.filename);
        moduleOwnersMap.set(result.path, result.owners);
    }
    const { approvers, rejecters } = await collectApprovers(octokit, headCommitSha);
    const committers = await collectCommitters(octokit);
    const requireApproveModules = calculateRequireApprovePerModules(approvers, rejecters, committers, moduleOwnersMap);
    let comment = "";
    if (requireApproveModules.size > 0) {
        const pathUserData = [];
        requireApproveModules.forEach((value, key) => {
            if (value != null) {
                pathUserData.push({ path: key, users: value.kind === OwnersManager_1.OwnersKind.list ? value.list : ["anyone"] });
                // comment += `- ${key}: ${value.kind === OwnersKind.list ? value.list : "anyone"}\n`;
            }
        });
        comment = commentFormatter.format(pathUserData);
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
        await doApproverCheckLogic(octokit, headCommitSha, new CommentFormatter_1.TableCommentFormatter());
    }
    catch (error) {
        core.setFailed(error.message);
    }
};
run();
