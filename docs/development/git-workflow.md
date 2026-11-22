# Git Workflow

Build packages on `rebuild`. Deliver releases through `main`. Read [Lanes](../standards/README.md#lanes) for the checks each lane requires.

## Authorization

| ID    | Rule                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-01 | An implementation task authorizes no commit, push, pull request or merge beyond the standing authorization of GW-03. A granted permission is used fully within its named operation and candidate; it does not authorize other remote writes.                   |
| GW-02 | `main` changes only on David's explicit instruction, one merge at a time. A new candidate invalidates a merge instruction based on the previous approval; re-review requires a fresh merge instruction. Agents commit on working branches.                     |
| GW-03 | Pushing and creating remote repositories require David’s instruction. Standing authorization covers fast-forward pushes to `rebuild` and pushes to the private lab. Changes to `main`, force-pushes and remote branch deletion require separate authorization. |

## Branches

| ID    | Rule                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-10 | Work in short-lived worktrees and branches. Before writing, check branch, status and ownership. Prepare a fresh worktree with `bun run bootstrap`. [Scripts](../../scripts/README.md)                                                     |
| GW-11 | One writer per path. Write only assigned paths; leave external changes intact.                                                                                                                                                            |
| GW-12 | Branch names for the release lane: `feat/`, `fix/`, `docs/`, `design/`, `asset/`, `deps/` plus topic. A package branch on the build lane carries the package name.                                                                        |
| GW-13 | `rebuild` is the build lane and `main` is the release lane. `experimente` is a frozen read-only quarry. Port selected code from a quarry. Keep quarries out of merges.                                                                    |
| GW-15 | Deliver an accepted result on its own branch from `main` with only the selected change. Use a pull request. Keep `experimente` and `rebuild` out of release branches and merges into `main`.                                              |
| GW-16 | Explore in the private lab and build accepted packages on `rebuild`. Deliver a selected result to `main` through the [merge council](../standards/README.md#roles-and-review). Capture release evidence from the exact release candidate. |
| GW-17 | Create package worktrees from `rebuild`. Follow the [rebuild working rules](rebuild.md#working-rules). The [ship command](../../scripts/README.md#ship-a-package) verifies, integrates and captures the preview.                          |

## Commits

| ID    | Rule                                                                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-20 | One commit is one logical step. Stage named paths, never everything.                                                                                                                                        |
| GW-21 | Subject: Conventional Commits, English, imperative, at most 72 characters, e.g. `feat(raster): add universal grid core`.                                                                                    |
| GW-22 | Author and committer is the repo owner. No `Co-Authored-By` and no AI attribution in commits or pull requests; AI involvement appears once in the README ("Built with").                                    |
| GW-23 | Never commit secrets, dependencies, private skills (`.agents/skills/`, `.claude/skills/`), absolute local paths or external reference images. Local working material belongs in the private lab repository. |

## Example-First History

| ID    | Rule                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GW-30 | Release lane: accepted examples ([C-43](../standards/CODING_STANDARDS.md#reference-code)) are committed before the implementation. |
| GW-31 | Integrate with normal merge commits that keep these commits in order. No squash, no rebase merge.                                  |
| GW-32 | Preserve shared history. A force-push requires David’s separate instruction (GW-03).                                               |

## Delivery and Cleanup

| ID    | Rule                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-40 | On the release lane, run `bun run verify` before delivery and record only executed results. On the build lane, follow the package delivery in GW-17.     |
| GW-41 | Release lane: "delivered" means committed, pushed and represented by a current pull request with accurate title, description and check log.              |
| GW-42 | Link every created or pushed pull request with its full URL in T3; report if that fails.                                                                 |
| GW-43 | Before handoff, check branch, working tree, remote head, PR head and status; name open parallel work and pending checks.                                 |
| GW-50 | After a verified merge, delete the owned short-lived worktree and local branch. Remote branch deletion is a push and requires authorization under GW-03. |
| GW-51 | Cleanup never replaces delivery. Unintegrated or foreign work stays intact.                                                                              |

## Dependency Updates

| ID    | Rule                                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-55 | Dependency updates travel on their own `deps/` branch and pull request, never mixed with a feature or refactor. The lockfile changes in the same commit as `package.json`.                                                                  |
| GW-56 | A new dependency names license, size and benefit before it is added ([DOC-52](../standards/DOCUMENTATION_STANDARDS.md#sources-and-licenses)). Versions are pinned through `bun.lock`; tools that execute in CI or gates are pinned exactly. |
| GW-57 | Run `bun run verify` and browser tests for an update. An independent agent signs off on current browser screenshots of affected pages. [Design Standards](../standards/DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)                 |

## CI and Branch Protection

| ID    | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-60 | CI runs `bun run verify` and the release browser checks on a clean frozen install with the pinned Bun version.                                                                                                                                                                                                                                                         |
| GW-61 | The `main` ruleset requires a pull request (zero approvals: a solo identity cannot approve itself), the `verify` check from GitHub Actions, an up-to-date branch, and blocks force push and deletion. Merge commits only; linear history is not required. It is applied only after `verify` has reported on `main`, so `main` never waits for a check that cannot run. |
| GW-62 | The review council supports the merge authorization rule (GW-02). The release lane uses no custom council status check or mandatory pre-push hook. Changes to `.github/**`, `scripts/**` and tool configuration require specialist review.                                                                                                                             |

## Lab Transfer

| ID    | Rule                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GW-70 | A transfer from the lab copies only the selected final result: original work or restyled adaptation, with its provenance (prompt or source, author decision, date) stated in the commit or pull request. Raw variants, prompts, notes and references stay in the lab.      |
| GW-71 | Before a transfer, check: every file is needed by a page or test; no third-party reference or `ext-*` image; no large disposable copies (PDFs, datasets, renders not shown on the site); no link or path into the lab. A filename alone proves neither origin nor license. |
| GW-72 | The lab may link to this public repository. This repository never links to the lab.                                                                                                                                                                                        |
