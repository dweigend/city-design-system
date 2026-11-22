# Design Bible Standards

## Precedence

1. David's explicit decisions. The most recent decision governs.
2. [AGENTS.md](../../AGENTS.md).
3. The standards below. Each fact has one owner. Other documents link to it.

Report conflicting rules to David. [Research](../research/README.md) provides evidence and rationale.

## Lanes

- **Build lane, `rebuild`.** Follow the [rebuild brief](../development/rebuild.md) and [Git Workflow](../development/git-workflow.md). The builder runs the checks and captures the picture on the hardware GPU when a package delivers one.
- **Release lane, `main`.** Deliver a selected change on its own branch from `main`, through a pull request, `bun run verify`, the merge council and David's merge instruction. Browser-facing changes and dependency updates require real browser tests and independent sign-off.
- **Quarry, `experimente`.** Read it to port a selected piece into the rebuild.

### What to read

Read the principles for the area and the standard for the work.

| Work                                                 | Read                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Visible design                                       | [Principles register](../../src/routes/design-principles.ts) and the relevant bible page |
| Layers, modules and dependencies                     | [Architecture](ARCHITECTURE.md)                                                          |
| Code, public APIs and refactors                      | [Coding Standards](CODING_STANDARDS.md)                                                  |
| Names and domain terms                               | [Naming Conventions](NAMING_CONVENTIONS.md), [Glossary](GLOSSARY.md)                     |
| Units, geometry, determinism and measurement         | [Procedural Principles](PROCEDURAL_PRINCIPLES.md)                                        |
| Visual design, accessibility and screenshot evidence | [Design Standards](DESIGN_STANDARDS.md)                                                  |
| Page content, sources and evidence                   | [Documentation Standards](DOCUMENTATION_STANDARDS.md)                                    |
| Checks, shipping and capture                         | [Scripts](../../scripts/README.md)                                                       |

## Roles and Review

These roles apply on the release lane.

- The implementer and reviewer are different agents.
- Critical changes to CI, workflows, build configuration or secrets require specialist review.
- Two independent reviews are mandatory for the merge council. David authorizes the merge.
- Sign-off requires a completed review. Critical or ambiguous decisions go to David.
- Browser sign-off requires an independent review of current screenshots. Record the candidate SHA, any local diff, route, seed, camera, viewport, theme, browser and renderer as applicable. [Design Standards](DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)
- Record findings and responses separately from sign-off. Report only real issues.

## Verification Commands

[Scripts](../../scripts/README.md) lists the checks. [Architecture](ARCHITECTURE.md#rules) maps each rule to its check. A rule enters the standard with a check and a probe that triggers it. Report only executed checks.

## Local Skills

Private skills under `.agents/skills/` and `.claude/skills/` stay untracked. Run `bun run check:skills` to check the Git index.
