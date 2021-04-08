import {calculateRequireApprovePerModules} from "../src/index";
import {Owners, OwnersKind} from "../src/OwnersManager";

interface TestCaseData {
	name: string;
	approvers: string[];
	rejecters: string[];
	committers: string[];
	owners: "anyone" | string[];
	expect: "empty" | "anyone" | string[];
}

describe("Require approves per modules", () => {
	const testCases: TestCaseData[] = [
		{
			name: "one approve",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userX"],
			owners: ["userA", "userB"],
			expect: "empty",
		},

		{
			name: "one commiter approve",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userA"],
			owners: ["userA", "userB"],
			expect: ["userB"],
		},

		{
			name: "two commiter approve",
			approvers: ["userA", "userB"],
			rejecters: [],
			committers: ["userA", "userB"],
			owners: ["userA", "userB"],
			expect: "empty",
		},

		{
			name: "commiter reject",
			approvers: ["userA"],
			rejecters: ["userB"],
			committers: ["userB"],
			owners: ["userA", "userB"],
			expect: ["userA", "userB"],
		},

		{
			name: "commiter rejected other owner approved",
			approvers: ["userA"],
			rejecters: ["userB"],
			committers: ["userB"],
			owners: ["userA", "userB"],
			expect: ["userB"],
		},

		{
			name: "one owner other committed",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userX"],
			owners: ["userA"],
			expect: "empty",
		},

		{
			name: "one owner other committed",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userX"],
			owners: ["userA"],
			expect: "empty",
		},

		{
			name: "one owner who committed",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userA"],
			owners: ["userA"],
			expect: "anyone",
		},

		{
			name: "no owner committer approve",
			approvers: ["userA"],
			rejecters: [],
			committers: ["userA"],
			owners: "anyone",
			expect: "anyone",
		},

		{
			name: "no owner committer reject",
			approvers: [],
			rejecters: ["userA"],
			committers: ["userA"],
			owners: "anyone",
			expect: ["userA"],
		},
	];

	testCases.forEach((tc) => {
		it(tc.name, () => {
			const moduleName = "module";
			const owners: Owners =
				tc.owners === "anyone" ? {kind: OwnersKind.anyone} : {kind: OwnersKind.list, list: tc.owners};
			const result = calculateRequireApprovePerModules(
				new Set(tc.approvers),
				new Set(tc.rejecters),
				new Set(tc.committers),
				new Map([[moduleName, owners]]),
			);
			if (tc.expect === "empty") {
				expect(result.size).toBe(0);
			} else if (tc.expect === "anyone") {
				const requiredApproves = result.get(moduleName);
				if (requiredApproves != null) {
					expect(requiredApproves.kind).toBe(OwnersKind.anyone);
				} else {
					fail("module not exist");
				}
			} else {
				const requiredApproves = result.get(moduleName);
				if (requiredApproves != null && requiredApproves.kind === OwnersKind.list) {
					expect(requiredApproves.list.every((a) => tc.expect.indexOf(a) > -1)).toBe(true);
				} else {
					fail("module not exist");
				}
			}
		});
	});
});
