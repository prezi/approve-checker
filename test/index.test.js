"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import * as core from "@actions/core";
// import { GitHub } from "@actions/github/lib/utils";
const index_1 = require("../index");
const userA = "userA";
const userABase64 = "dXNlckE=";
const userB = "userB";
const userAuserBBase64 = "dXNlckEKdXNlckI=";
const ownerA = {
    kind: index_1.OwnersKind.list,
    list: [userA]
};
const ownerAownerB = {
    kind: index_1.OwnersKind.list,
    list: [userA, userB]
};
const noOwner = {
    kind: index_1.OwnersKind.anyone
};
const Test1 = new Map([
    ["OWNERS", { data: { content: userABase64 } }],
    ["moduleA/OWNERS", { data: { content: userAuserBBase64 } }]
]);
const Test2 = new Map([
    ["moduleA/OWNERS", { data: { content: userAuserBBase64 } }]
]);
class OctokitMock {
    constructor(testData) {
        this.testData = testData;
        this.cnt = 0;
    }
    ;
    request(_, param) {
        ++this.cnt;
        return this.testData.get(param.path);
    }
    get counter() {
        return this.cnt;
    }
}
function equalOwners(a, b) {
    if (a.kind === index_1.OwnersKind.anyone && b.kind === index_1.OwnersKind.anyone) {
        return true;
    }
    if (a.kind === index_1.OwnersKind.list && b.kind === index_1.OwnersKind.list) {
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
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("source.js");
        const owners2 = await ownersManager.collectOwners("anotherSource.js");
        expect(octokitMock.counter).toBe(1);
        expect(equalOwners(owners1, ownerA)).toBe(true);
        expect(equalOwners(owners2, ownerA)).toBe(true);
    });
    it("Two file in a nested directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("moduleA/source.js");
        const owners2 = await ownersManager.collectOwners("moduleA/anotherSource.js");
        expect(octokitMock.counter).toBe(1);
        expect(equalOwners(owners1, ownerAownerB)).toBe(true);
        expect(equalOwners(owners2, ownerAownerB)).toBe(true);
    });
    it("No owners in the current directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("moduleB/dir1/source.js");
        const owners2 = await ownersManager.collectOwners("moduleB/dir1/anotherSource.js");
        const owners3 = await ownersManager.collectOwners("moduleB/dir2/x.js");
        const owners4 = await ownersManager.collectOwners("moduleB/y.js");
        expect(octokitMock.counter).toBe(4);
        expect(equalOwners(owners1, ownerA)).toBe(true);
        expect(equalOwners(owners2, ownerA)).toBe(true);
        expect(equalOwners(owners3, ownerA)).toBe(true);
        expect(equalOwners(owners4, ownerA)).toBe(true);
    });
    it("Maybe owners in the current directory", async () => {
        const octokitMock = new OctokitMock(Test1);
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("moduleA/dir1/source.js");
        const owners2 = await ownersManager.collectOwners("moduleA/dir1/anotherSource.js");
        const owners3 = await ownersManager.collectOwners("moduleA/dir2/x.js");
        const owners4 = await ownersManager.collectOwners("moduleA/y.js");
        const owners5 = await ownersManager.collectOwners("moduleB/z.js");
        expect(octokitMock.counter).toBe(5);
        expect(equalOwners(owners1, ownerAownerB)).toBe(true);
        expect(equalOwners(owners2, ownerAownerB)).toBe(true);
        expect(equalOwners(owners3, ownerAownerB)).toBe(true);
        expect(equalOwners(owners4, ownerAownerB)).toBe(true);
        expect(equalOwners(owners5, ownerA)).toBe(true);
    });
    it("No owners at all", async () => {
        const octokitMock = new OctokitMock(new Map());
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("moduleA/dir1/source.js");
        const owners2 = await ownersManager.collectOwners("moduleA/dir1/anotherSource.js");
        const owners3 = await ownersManager.collectOwners("moduleA/dir2/x.js");
        const owners4 = await ownersManager.collectOwners("moduleA/y.js");
        const owners5 = await ownersManager.collectOwners("moduleB/z.js");
        expect(octokitMock.counter).toBe(5);
        expect(equalOwners(owners1, noOwner)).toBe(true);
        expect(equalOwners(owners2, noOwner)).toBe(true);
        expect(equalOwners(owners3, noOwner)).toBe(true);
        expect(equalOwners(owners4, noOwner)).toBe(true);
        expect(equalOwners(owners5, noOwner)).toBe(true);
    });
    it("A subdir has owners only", async () => {
        const octokitMock = new OctokitMock(Test2);
        const ownersManager = new index_1.OwnersManager("", "", "", octokitMock);
        const owners1 = await ownersManager.collectOwners("moduleA/a.js");
        const owners2 = await ownersManager.collectOwners("moduleB/b.js");
        expect(octokitMock.counter).toBe(3);
        expect(equalOwners(owners1, ownerAownerB)).toBe(true);
        expect(equalOwners(owners2, noOwner)).toBe(true);
    });
});
