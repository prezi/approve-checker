import * as core from "@actions/core";
import run from "../index";
/*eslint indent: ["error", "tab"]*/
describe("debug action debug messages", () => {
	it("outputs a debug message", async () => {
		const debugMock = jest.spyOn(core, "debug");
		await run();
		expect(debugMock).toHaveBeenCalledWith("Hello World");
	});
});
