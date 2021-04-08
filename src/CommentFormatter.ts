export interface PathUserData {
	path: string;
	users: ReadonlyArray<string>;
}
export interface CommentFormatter {
	format(data: ReadonlyArray<PathUserData>): string;
}

export class SimpleCommentFormatter {
	public format(data: ReadonlyArray<PathUserData>): string {
		return data.reduce((prev, curr) => prev + `- ${curr.path}: ${curr.users}\n`, "");
	}
}

export class TableCommentFormatter {
	public format(data: ReadonlyArray<PathUserData>): string {
		const header = "|modules|owners|\n|---|---|\n";
		const content = data.reduce(
			(prev, curr) => prev + `| ${curr.path} | ${curr.users.reduce((prev, curr) => prev + "<br>" + curr)} |\n`,
			"",
		);
		return header + content;
	}
}
