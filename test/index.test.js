"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OwnersManager_1 = require("../src/OwnersManager");
const index_1 = require("../src/index");
const CommentFormatter_1 = require("../src/CommentFormatter");
const noFiles = { data: [] };
const noApprovers = { data: [] };
const userA = "userA";
const userABase64 = "dXNlckE=";
const userB = "userB";
const userAuserBBase64 = "dXNlckEKdXNlckI=";
const userNotInOwnersfile = "userNotInOwnersfile";
const ownerA = {
    kind: OwnersManager_1.OwnersKind.list,
    list: [userA],
};
const ownerAownerB = {
    kind: OwnersManager_1.OwnersKind.list,
    list: [userA, userB],
};
const noOwner = {
    kind: OwnersManager_1.OwnersKind.anyone,
};
const Test1 = {
    ownersfileData: new Map([
        ["OWNERSFILE", { data: { content: userABase64 } }],
        ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
    ]),
    approvers: noApprovers,
    changedFiles: noFiles,
    headCommitSha: "",
};
const Test2 = {
    ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
    approvers: noApprovers,
    changedFiles: noFiles,
    headCommitSha: "",
};
class OctokitMock {
    constructor(mockSetup) {
        this.mockSetup = mockSetup;
        this.cnt = 0;
        this.status = "nothing";
        this.comment = "";
    }
    get counter() {
        return this.cnt;
    }
    getFileContent(path) {
        ++this.cnt;
        return this.mockSetup.ownersfileData.get(path);
    }
    getReviews() {
        return this.mockSetup.approvers;
    }
    getComments() {
        return { data: [] };
    }
    getCommits() {
        return { data: [] };
    }
    updateComment(_, comment) {
        this.comment = comment;
    }
    addComment(comment) {
        this.comment = comment;
    }
    getFiles() {
        return this.mockSetup.changedFiles;
    }
    updateStatus(state) {
        this.status = state;
    }
    getStatus() {
        return this.status;
    }
    getComment() {
        return this.comment;
    }
}
function equalOwners(a, b) {
    if (a.kind === OwnersManager_1.OwnersKind.anyone && b.kind === OwnersManager_1.OwnersKind.anyone) {
        return true;
    }
    if (a.kind === OwnersManager_1.OwnersKind.list && b.kind === OwnersManager_1.OwnersKind.list) {
        if (a.list.length === b.list.length) {
            for (let i = 0; i < a.list.length; ++i) {
                if (a.list[i] !== b.list[i]) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}
describe("Test ownersfile lookup", () => {
    it("Two file in the root directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("source.js");
        const res2 = await ownersManager.collectOwners("anotherSource.js");
        expect(octokitMock.counter).toBe(1);
        expect(equalOwners(res1.owners, ownerA)).toBe(true);
        expect(equalOwners(res2.owners, ownerA)).toBe(true);
    });
    it("Two file in a nested directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("moduleA/source.js");
        const res2 = await ownersManager.collectOwners("moduleA/anotherSource.js");
        expect(octokitMock.counter).toBe(1);
        expect(equalOwners(res1.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res2.owners, ownerAownerB)).toBe(true);
    });
    it("No owners in the current directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("moduleB/dir1/source.js");
        const res2 = await ownersManager.collectOwners("moduleB/dir1/anotherSource.js");
        const res3 = await ownersManager.collectOwners("moduleB/dir2/x.js");
        const res4 = await ownersManager.collectOwners("moduleB/y.js");
        expect(octokitMock.counter).toBe(4);
        expect(equalOwners(res1.owners, ownerA)).toBe(true);
        expect(equalOwners(res2.owners, ownerA)).toBe(true);
        expect(equalOwners(res3.owners, ownerA)).toBe(true);
        expect(equalOwners(res4.owners, ownerA)).toBe(true);
    });
    it("Maybe owners in the current directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("moduleA/dir1/source.js");
        const res2 = await ownersManager.collectOwners("moduleA/dir1/anotherSource.js");
        const res3 = await ownersManager.collectOwners("moduleA/dir2/x.js");
        const res4 = await ownersManager.collectOwners("moduleA/y.js");
        const res5 = await ownersManager.collectOwners("moduleB/z.js");
        expect(octokitMock.counter).toBe(5);
        expect(equalOwners(res1.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res2.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res3.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res4.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res5.owners, ownerA)).toBe(true);
    });
    it("No owners at all", async () => {
        const octokitMock = new OctokitMock({
            approvers: noApprovers,
            changedFiles: noFiles,
            ownersfileData: new Map(),
            headCommitSha: "",
        });
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("moduleA/dir1/source.js");
        const res2 = await ownersManager.collectOwners("moduleA/dir1/anotherSource.js");
        const res3 = await ownersManager.collectOwners("moduleA/dir2/x.js");
        const res4 = await ownersManager.collectOwners("moduleA/y.js");
        const res5 = await ownersManager.collectOwners("moduleB/z.js");
        expect(octokitMock.counter).toBe(5);
        expect(equalOwners(res1.owners, noOwner)).toBe(true);
        expect(equalOwners(res2.owners, noOwner)).toBe(true);
        expect(equalOwners(res3.owners, noOwner)).toBe(true);
        expect(equalOwners(res4.owners, noOwner)).toBe(true);
        expect(equalOwners(res5.owners, noOwner)).toBe(true);
    });
    it("A subdir has owners only", async () => {
        const octokitMock = new OctokitMock(Test2);
        const ownersManager = new OwnersManager_1.OwnersManager(octokitMock);
        const res1 = await ownersManager.collectOwners("moduleA/a.js");
        const res2 = await ownersManager.collectOwners("moduleB/b.js");
        expect(octokitMock.counter).toBe(3);
        expect(equalOwners(res1.owners, ownerAownerB)).toBe(true);
        expect(equalOwners(res2.owners, noOwner)).toBe(true);
    });
    // TODO subdir has empty list
    // TODO check path
});
const noMoreApprovalNeededComment = "Approvals in the following modules are missing:\n\nNo more approvals are needed";
const approvalsNeededComment = (data) => {
    const msg = data.reduce((val, d) => val + `- ${d.path}: ${d.users}\n`, "");
    return `Approvals in the following modules are missing:\n\n${msg}`;
};
describe("Test the full flow", () => {
    const testCases = [
        {
            name: "one approve",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }] },
                approvers: { data: [{ user: { login: userA }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "one approve is missing",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }, { filename: "index.js" }] },
                approvers: { data: [{ user: { login: userB }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userA] }]),
                status: "failure",
            },
        },
        {
            name: "no approve - one file changed",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }] },
                approvers: { data: [] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: "moduleA", users: [userA, userB] }]),
                status: "failure",
            },
        },
        {
            name: "no approve - two files changed",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }, { filename: "index.js" }] },
                approvers: { data: [] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([
                    { path: "moduleA", users: [userA, userB] },
                    { path: ".", users: [userA] },
                ]),
                status: "failure",
            },
        },
        {
            name: "approver approved then requested change",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userB }, state: "APPROVED", commit_id: "1" },
                        { user: { login: userB }, state: "CHANGES_REQUESTED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: "moduleA", users: [userB] }]),
                status: "failure",
            },
        },
        {
            name: "approver approved then requested change then approved again",
            initialData: {
                ownersfileData: new Map([
                    ["OWNERSFILE", { data: { content: userABase64 } }],
                    ["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userB }, state: "APPROVED", commit_id: "1" },
                        { user: { login: userB }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "APPROVED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "One module has no Owners file - no approve at all",
            initialData: {
                ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }, { filename: "index.js" }] },
                approvers: { data: [] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([
                    { path: "moduleA", users: [userA, userB] },
                    { path: ".", users: ["anyone"] },
                ]),
                status: "failure",
            },
        },
        {
            name: "One module has no Owners file - approve comes from other module",
            initialData: {
                ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }, { filename: "index.js" }] },
                approvers: { data: [{ user: { login: userB }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "One module has no Owners file - multiple changes - third user approved",
            initialData: {
                ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }, { filename: "index.js" }] },
                approvers: { data: [{ user: { login: userNotInOwnersfile }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: "moduleA", users: [userA, userB] }]),
                status: "failure",
            },
        },
        {
            name: "One moudle has no Owners file - change from that module - third user approved",
            initialData: {
                ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: { data: [{ user: { login: userNotInOwnersfile }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "One moudle has no Owners file - third user requested change",
            initialData: {
                ownersfileData: new Map([["moduleA/OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }, { filename: "moduleA/index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userNotInOwnersfile }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userA }, state: "APPROVED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userNotInOwnersfile] }]),
                status: "failure",
            },
        },
        {
            name: "Non owner approval doesn't count",
            initialData: {
                ownersfileData: new Map([
                    ["moduleA/OWNERSFILE", { data: { content: userABase64 } }],
                    ["./OWNERSFILE", { data: { content: userAuserBBase64 } }],
                ]),
                changedFiles: { data: [{ filename: "moduleA/index.js" }] },
                approvers: { data: [{ user: { login: userB }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: "moduleA", users: [userA] }]),
                status: "failure",
            },
        },
        {
            name: "Two rejecters",
            initialData: {
                ownersfileData: new Map([["./OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userA }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "CHANGES_REQUESTED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userA, userB] }]),
                status: "failure",
            },
        },
        {
            name: "Two rejecter then one approver",
            initialData: {
                ownersfileData: new Map([["./OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userA }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "APPROVED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userA] }]),
                status: "failure",
            },
        },
        {
            name: "Two rejecter then two approver",
            initialData: {
                ownersfileData: new Map([["./OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userA }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "APPROVED", commit_id: "1" },
                        { user: { login: userA }, state: "APPROVED", commit_id: "1" },
                    ],
                },
                headCommitSha: "1",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "New commit after approve",
            initialData: {
                ownersfileData: new Map([["OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: { data: [{ user: { login: userA }, state: "APPROVED", commit_id: "1" }] },
                headCommitSha: "2",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userA, userB] }]),
                status: "failure",
            },
        },
        {
            name: "New commit after approve different user approves next",
            initialData: {
                ownersfileData: new Map([["OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userA }, state: "APPROVED", commit_id: "1" },
                        { user: { login: userB }, state: "APPROVED", commit_id: "2" },
                    ],
                },
                headCommitSha: "2",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
        {
            name: "Request change then commit then other user approved",
            initialData: {
                ownersfileData: new Map([["OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: {
                    data: [
                        { user: { login: userA }, state: "CHANGES_REQUESTED", commit_id: "1" },
                        { user: { login: userB }, state: "APPROVED", commit_id: "2" },
                    ],
                },
                headCommitSha: "2",
            },
            expect: {
                comment: approvalsNeededComment([{ path: ".", users: [userA] }]),
                status: "failure",
            },
        },
        {
            name: "Approved comment also approves",
            initialData: {
                ownersfileData: new Map([["OWNERSFILE", { data: { content: userAuserBBase64 } }]]),
                changedFiles: { data: [{ filename: "index.js" }] },
                approvers: { data: [{ user: { login: userB }, state: "COMMENTED", commit_id: "2", body: "approved" }] },
                headCommitSha: "2",
            },
            expect: {
                comment: noMoreApprovalNeededComment,
                status: "success",
            },
        },
    ];
    testCases.forEach((tc) => {
        it(tc.name, async () => {
            const om = new OctokitMock(tc.initialData);
            expect(om.getStatus()).toBe("nothing");
            const status = await index_1.doApproverCheckLogic(om, tc.initialData.headCommitSha, new CommentFormatter_1.SimpleCommentFormatter());
            expect(status).toBe(tc.expect.status);
            if (tc.expect.comment != "") {
                expect(om.getComment()).toBe(tc.expect.comment);
            }
        });
    });
});
