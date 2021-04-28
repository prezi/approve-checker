About
=====

Approve Checker is a Github Action which allows to set up code owner groups in directory level and checks if at least one owner approved the pull request from every group.

Usage
=====

Set up code owners
---------------------------
Create an `OWNERS` file for each directory where you want to set up owner groups. The `OWNERS` file should contain the GitHub identifiers of the owners. If a directory (`D`) has no `OWNERS` file the tool will look up its parent directory until an `OWNERS` file is found. This `OWNERS` file will be applied for `D`. If the root directory is reached no `OWNERS` file is found and approval from any user will fulfill the requirement of `D`.

Set up the action
-----------------------

Create a workflow file in your repo root:

```
mkdir -p .github/workflows
cd .github/workflows
touch check-approvers.yml
```
In the `check-approvers.yml` file add:
```
name: check-approvers
on: [pull_request, pull_request_review]
jobs:
  test-mergability:
    runs-on: ubuntu-latest
    steps:
      - uses: prezi/approve-checker@master
        with:
          repository: ${{ github.repository }}
          pr-number: ${{ github.event.pull_request.number }}
          myToken: ${{ secrets.GITHUB_TOKEN }}
```

Make changes in the code
====================
Prerequisite:
npm: 6.9+
Node: 10+

To install the dependencies go to the project root and
```
npm install
```
To build your changes
```
npm run build
```
To run the linter
```
npm run lint
```
To run the tests
```
npm run test
```
x
