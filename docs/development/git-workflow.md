# Git Workflow

As of 2026-11-17. Owner for authorization, branches, commits, example-first history, delivery and cleanup. Authority letters (D, N, V) follow the [Standards README](../standards/README.md#legend).

Remote: GitHub `city-design-system`. No CI workflow, no ruleset.

## Authorization

| ID    | Rule                                                                                                          | Auth. |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----- |
| GW-01 | An implementation task authorizes no commit, push, pull request or merge. A granted permission is used fully. | N     |
| GW-02 | `main` changes only on David's explicit instruction, one merge at a time. Agents commit on working branches.  | D     |
| GW-03 | Pushing and creating remote repositories only on David's instruction.                                         | D     |

## Branches

| ID    | Rule                                                                                                                                                                                                                                                                                                      | Auth. |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-10 | Work in short-lived worktrees and branches. Before writing, check branch, status and ownership.                                                                                                                                                                                                           | D     |
| GW-11 | One writer per path. Write only assigned paths; leave external changes intact.                                                                                                                                                                                                                            | N     |
| GW-12 | Branch names: `feat/`, `fix/`, `docs/`, `design/`, `asset/` plus topic.                                                                                                                                                                                                                                   | N\*   |
| GW-13 | Three permanent branches: `main` (stable), `experimente` (`main` plus experiments, rebased after each merge) and `radikal` (local only, never pushed). No fourth without David. Research, ideas and side experiments live in the private sibling repo `city-design-lab`; only accepted results move here. | D     |

## Commits

| ID    | Rule                                                                                                                                                                                         | Auth. |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-20 | One commit is one logical step. Stage named paths, never everything.                                                                                                                         | N\*   |
| GW-21 | Subject: Conventional Commits, English, imperative, at most 72 characters, e.g. `feat(raster): add universal grid core`.                                                                     | N     |
| GW-22 | Author and committer is the repo owner. No `Co-Authored-By` and no AI attribution in commits or pull requests; AI involvement appears once in the README ("Built with").                     | D     |
| GW-23 | Never commit secrets, dependencies, private skills (`.agents/skills/`, `.claude/skills/`), absolute local paths or external reference images. Local material goes to `_lokal/` (gitignored). | D     |

## Example-First History

| ID    | Rule                                                                                                                 | Auth. |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-30 | Accepted examples ([C-43](../standards/CODING_STANDARDS.md#reference-code)) are committed before the implementation. | N     |
| GW-31 | Integrate with normal merges that keep these commits in order. No squash.                                            | N     |
| GW-32 | Never rewrite shared history. Only exception: the `experimente` rebase (GW-13), pushed with `--force-with-lease`.    | D     |

## Delivery and Cleanup

| ID    | Rule                                                                                                                             | Auth. |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-40 | Before delivery, `bun run verify` runs ([C-60–62](../standards/CODING_STANDARDS.md#verification)). Record only executed results. | N     |
| GW-41 | "Delivered" means committed, pushed and represented by a current pull request with accurate title, description and check log.    | N     |
| GW-42 | Link every created or pushed pull request with its full URL in T3; report if that fails.                                         | N     |
| GW-43 | Before handoff, check branch, working tree, remote head, PR head and status; name open parallel work and pending checks.         | N     |
| GW-50 | After a verified merge, delete the short-lived worktree and branch.                                                              | D     |
| GW-51 | Cleanup never replaces delivery. Unintegrated or foreign work stays intact.                                                      | N     |
