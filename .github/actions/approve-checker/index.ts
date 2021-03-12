import * as core from "@actions/core";

const run = async (): Promise<void> => {
	core.debug("Hello World");
};

run();

export default run;
