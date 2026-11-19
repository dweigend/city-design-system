# Git Workflow

Remote: GitHub `city-design-system`. CI: `.github/workflows/verify.yml` (job `verify`). Ruleset for `main`: prepared in `.github/rulesets/main.json`, applied only after the workflow has reported on `main` (GW-61).

## Authorization

| ID    | Rule                                                                                                                                                                                                                                       | Auth. |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| GW-01 | An implementation task authorizes no commit, push, pull request or merge. A granted permission is used fully within its named operation and candidate; it does not authorize other remote writes.                                          | N     |
| GW-02 | `main` changes only on David's explicit instruction, one merge at a time. A new candidate invalidates a merge instruction based on the previous approval; re-review requires a fresh merge instruction. Agents commit on working branches. | D     |
| GW-03 | Pushing and creating remote repositories only on David's instruction.                                                                                                                                                                      | D     |

## Branches

| ID    | Rule                                                                                                                                                                                                                                                                                                                                                                                            | Auth. |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-10 | Work in short-lived worktrees and branches. Before writing, check branch, status and ownership. `bun run bootstrap` prepares a fresh worktree ([scripts/README](../../scripts/README.md#worktree-setup)).                                                                                                                                                                                       | D     |
| GW-11 | One writer per path. Write only assigned paths; leave external changes intact.                                                                                                                                                                                                                                                                                                                  | N     |
| GW-12 | Branch names: `feat/`, `fix/`, `docs/`, `design/`, `asset/`, `deps/` plus topic.                                                                                                                                                                                                                                                                                                                | N\*   |
| GW-13 | Two permanent branches: `main` (stable) and `experimente` (`main` plus experiments). No third without David. Research, ideas and side experiments live in the private lab repository; only accepted results move here (GW-70).                                                                                                                                                                  | D     |
| GW-14 | **`experimente` is rebased, never rebuilt.** After every authorized merge into `main`: rebase `experimente` onto `main` and run `bun run verify` on `experimente`. Its existing experiment commits are preserved in order. The push with `--force-with-lease` rewrites remote history and needs David's separate, explicit instruction; a merge instruction does not include it (GW-03, GW-32). | D     |
| GW-15 | **`experimente` is never merged into `main`.** An accepted experiment is delivered on its own branch created from `main`, carrying only the accepted change, through a pull request. No topic branch is created from or merged with `experimente`.                                                                                                                                              | D     |
| GW-16 | Flow: uncertain experiment in the private lab repository → targeted integration into `experimente` for a whole-system trial → selected result on its own branch from `main` → pull request and review council (README [Roles and Review](../standards/README.md#roles-and-review)) → `main`. A preview of `experimente` is never evidence for a `main` candidate.                               | D     |

## Commits

| ID    | Rule                                                                                                                                                                                                        | Auth. |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-20 | One commit is one logical step. Stage named paths, never everything.                                                                                                                                        | N\*   |
| GW-21 | Subject: Conventional Commits, English, imperative, at most 72 characters, e.g. `feat(raster): add universal grid core`.                                                                                    | N     |
| GW-22 | Author and committer is the repo owner. No `Co-Authored-By` and no AI attribution in commits or pull requests; AI involvement appears once in the README ("Built with").                                    | D     |
| GW-23 | Never commit secrets, dependencies, private skills (`.agents/skills/`, `.claude/skills/`), absolute local paths or external reference images. Local working material belongs in the private lab repository. | D     |

## Example-First History

| ID    | Rule                                                                                                                                              | Auth. |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-30 | Accepted examples ([C-43](../standards/CODING_STANDARDS.md#reference-code)) are committed before the implementation.                              | N     |
| GW-31 | Integrate with normal merge commits that keep these commits in order. No squash, no rebase merge.                                                 | N     |
| GW-32 | Never rewrite shared history. Only exception: the `experimente` rebase (GW-14), pushed with `--force-with-lease` on David's separate instruction. | D     |

## Delivery and Cleanup

| ID    | Rule                                                                                                                                                     | Auth. |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-40 | Before delivery, `bun run verify` runs ([C-60–62](../standards/CODING_STANDARDS.md#verification)). Record only executed results.                         | N     |
| GW-41 | "Delivered" means committed, pushed and represented by a current pull request with accurate title, description and check log.                            | N     |
| GW-42 | Link every created or pushed pull request with its full URL in T3; report if that fails.                                                                 | N     |
| GW-43 | Before handoff, check branch, working tree, remote head, PR head and status; name open parallel work and pending checks.                                 | N     |
| GW-50 | After a verified merge, delete the owned short-lived worktree and local branch. Remote branch deletion is a push and requires authorization under GW-03. | D     |
| GW-51 | Cleanup never replaces delivery. Unintegrated or foreign work stays intact.                                                                              | N     |

## Dependency Updates

| ID    | Rule                                                                                                                                                                                                                                        | Auth. |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-55 | Dependency updates travel on their own `deps/` branch and pull request, never mixed with a feature or refactor. The lockfile changes in the same commit as `package.json`.                                                                  | D     |
| GW-56 | A new dependency names license, size and benefit before it is added ([DOC-52](../standards/DOCUMENTATION_STANDARDS.md#sources-and-licenses)). Versions are pinned through `bun.lock`; tools that execute in CI or gates are pinned exactly. | N\*   |
| GW-57 | An update passes `bun run verify` and `bun run test:browser`, and an independent agent signs off on fresh browser screenshots of the affected pages ([DS-70, DS-71](../standards/DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)).     | D     |

## CI and Branch Protection

| ID    | Rule                                                                                                                                                                                                                                                                                                                                                                   | Auth. |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-60 | CI runs `bun run verify` and `bun run test:browser` on a clean frozen install with the pinned bun version. Baseline growth is measured against the immutable base commit of the pull request or push (`BASELINE_BASE`), never against a moving branch name.                                                                                                            | D     |
| GW-61 | The `main` ruleset requires a pull request (zero approvals: a solo identity cannot approve itself), the `verify` check from GitHub Actions, an up-to-date branch, and blocks force push and deletion. Merge commits only; linear history is not required. It is applied only after `verify` has reported on `main`, so `main` never waits for a check that cannot run. | D     |
| GW-62 | The review council supports the merge authorization rule (GW-02). No custom council status check and no mandatory pre-push hook. Because a pull request runs its own workflow and gate scripts, changes to `.github/**`, `scripts/**`, the baselines and tool configuration are always in council scope and require specialist review.                                 | D     |

## Lab Transfer

| ID    | Rule                                                                                                                                                                                                                                                                       | Auth. |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| GW-70 | A transfer from the lab copies only the selected final result: original work or restyled adaptation, with its provenance (prompt or source, author decision, date) stated in the commit or pull request. Raw variants, prompts, notes and references stay in the lab.      | D     |
| GW-71 | Before a transfer, check: every file is needed by a page or test; no third-party reference or `ext-*` image; no large disposable copies (PDFs, datasets, renders not shown on the site); no link or path into the lab. A filename alone proves neither origin nor license. | N\*   |
| GW-72 | The lab may link to this public repository. This repository never links to the lab.                                                                                                                                                                                        | D     |
