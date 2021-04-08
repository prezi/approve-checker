import * as github from "@actions/github";
import {GitHub} from "@actions/github/lib/utils";

export class OctokitWrapper {
	private octokit: InstanceType<typeof GitHub>;
	public constructor(
		private owner: string,
		private repo: string,
		private prNum: string,
		private headCommitSha: string,
		token: string
	) {
		this.octokit = github.getOctokit(token);
	}

	public getReviews() {
		return this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
			owner: this.owner,
			repo: this.repo,
			pull_number: +this.prNum,
		});
	}

	public getComments() {
		return this.octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner: this.owner,
			repo: this.repo,
			issue_number: +this.prNum,
		});
	}

	public getCommits() {
		return this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
			owner: this.owner,
			repo: this.repo,
			pull_number: +this.prNum
		 });
	}

	public updateComment(commentId: number, message: string) {
		return this.octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
			owner: this.owner,
			repo: this.repo,
			comment_id: commentId,
			body: message,
		})
	}

	public addComment(message: string) {
		return this.octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner: this.owner,
			repo: this.repo,
			issue_number: +this.prNum,
			body: message,
		});
	}

	public getFiles() {
		return this.octokit.request(
			"GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files",
			{
				owner: this.owner,
				repo: this.repo,
				pull_number: this.prNum,
			},
		);
	}

	public getFileContent(path: string) {
		return this.octokit.request(
			"GET /repos/{owner}/{repo}/contents/{path}",
			{
				owner: this.owner,
				repo: this.repo,
				path: path,
			},
		);
	}

	public updateStatus(state: "failure" | "success") {
		return this.octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
			owner: this.owner,
			repo: this.repo,
			sha: this.headCommitSha,
			state: state,
		});
	}


}