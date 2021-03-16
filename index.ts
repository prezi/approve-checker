import * as core from "@actions/core";
import * as github from "@actions/github";

const run = async (): Promise<void> => {
	core.debug("Hello World");
	console.log({payload: github.context.payload});
};

run();

export default run;
