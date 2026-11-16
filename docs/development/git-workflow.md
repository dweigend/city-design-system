# Git Workflow

As of 2026-11-16. Draft; legend, source abbreviations, and status are in the [Standards README](../standards/README.md).

Owner for: authorization, branch and worktree ownership, commits, example-first history, delivery, cleanup. "Directive David" designates standing instructions previously documented only locally.

Remote: GitHub `city-design-system`. No CI workflow, no ruleset. The library's check names, ruleset, and `t3.json` do not apply here and are not claimed.

## Authorization

| ID    | Rule                                                                                                                                                   | Source · Auth.                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| GW-01 | An implementation task alone authorizes neither commit nor push, pull request, or merge. A granted permission is exercised fully without asking again. | GW Intro · N                      |
| GW-02 | `main` changes only on explicit instruction from David, one merge at a time. Agents commit on working branches.                                        | GW §Branches; Directive David · D |
| GW-03 | Pushing and creating a remote repository happen only on instruction from David.                                                                        | Directive David · D               |

## Branches and Ownership

| ID    | Rule                                                                                                                                                                                                                                                                                    | Source · Auth.                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| GW-10 | Work happens in short-lived worktrees and working branches. Before writing: check branch, status, and ownership.                                                                                                                                                                        | Directive David, 2026-11-16 · D |
| GW-11 | One writer per path. An agent writes only to the paths named for it. External changes remain intact and are not cleaned up.                                                                                                                                                             | GW §Branches; LA · N            |
| GW-12 | Short-lived branch names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`; for design and assets `design/<topic>`, `asset/<name>`.                                                                                                                                                        | GW §Branches · N\*              |
| GW-13 | Exactly three permanent branches: `main` (GitHub, stable), `experimente` (GitHub, `main` plus experimental commits; rebased onto `main` after each merge into `main`), and `radikal` (local only, never push). A fourth permanent branch requires explicit instruction from the author. | Directive David, 2026-11-16 · D |

## Commits

| ID    | Rule                                                                                                                                                                                                                                                                                                                                                            | Source · Auth.                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| GW-20 | One commit is one logical step. Files are staged selectively, never everything blindly.                                                                                                                                                                                                                                                                         | GW §Branches (atomic) · N\*             |
| GW-21 | Subject: Conventional Commits, English, imperative, at most 72 characters. Example: `feat(raster): add universal grid core`.                                                                                                                                                                                                                                    | GW §Branches; Current · N               |
| GW-22 | Author and committer is the repo owner. No `Co-Authored-By` lines and no AI attribution in commits or pull requests. AI involvement is stated once in the README under "Built with".                                                                                                                                                                            | Directive David · D                     |
| GW-23 | Never commit: secrets, dependencies, private skills (`.agents/skills/`, `.claude/skills/`), absolute local paths, external reference images. Local working and external images as well as internal evidence belong exclusively in `_lokal/` (gitignored). `git ls-files .agents/skills .claude/skills` stays empty; skills must never appear in history either. | LA; AG; Directive David, 2026-11-16 · D |

## Example-First History

| ID    | Rule                                                                                                                                                                                                                                                                                                                      | Source · Auth.                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| GW-30 | Accepted examples ([C-43](../standards/CODING_STANDARDS.md#reference-code)) are committed before implementation. History shows this order.                                                                                                                                                                                | GW Intro · N                                  |
| GW-31 | Integration via normal merges that preserve these commits and their order. No squashing of this evidence.                                                                                                                                                                                                                 | GW §Branches · N                              |
| GW-32 | Shared history is not rewritten, except for the prescribed rebase of `experimente` per GW-13. After that rebase, a force-push is permitted exclusively for `experimente` and exclusively with `--force-with-lease`. Other branches must not be updated by force-push. Pushes remain subject to authorization under GW-03. | GW §Branches; Directive David, 2026-11-16 · D |

## Verification and Delivery

| ID    | Rule                                                                                                                                                                                                                                  | Source · Auth.                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| GW-40 | Before delivery, the checks under [C-60 to C-62](../standards/CODING_STANDARDS.md#verification) run. Only executed results and their limits are recorded.                                                                             | GW §Deliver · N                  |
| GW-41 | A change is delivered when it is committed, pushed to the intended remote branch, and represented by a current pull request with an accurate title, description, and check log. If any part is missing, it is not called "delivered". | GW §Deliver · N                  |
| GW-42 | Every created, taken-over, or pushed pull request is immediately linked with its full URL in T3. If that fails, it is reported.                                                                                                       | GW §Deliver · N                  |
| GW-43 | Check before handoff: branch, working tree, remote head, PR head, and status. Open local or parallel work and pending checks are named.                                                                                               | GW §Deliver; SK git-delivery · N |
| GW-44 | Changes to `.github/workflows/`, build configuration, or secrets are reviewed with particular rigor.                                                                                                                                  | AG (Code Review Rules) · D       |

## Cleanup

| ID    | Rule                                                                                                                                                                                                                       | Source · Auth.                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| GW-50 | After merge, the short-lived worktree and working branch are deleted immediately once payload and evidence are integrated and verified and the checkout is clean. External or still-dependent work stays intact per GW-51. | Directive David, 2026-11-16 · D |
| GW-51 | Cleanup does not replace delivery. Non-integrated or parallel work remains intact.                                                                                                                                         | GW §Cleanup · N                 |

## Local Settings

Recommended, not required: `pull.ff=only` and `push.default=simple` per clone (GW §Enforced checks and local tooling · V). Conflicts are resolved; for force-push, only the exception under GW-32 applies.
