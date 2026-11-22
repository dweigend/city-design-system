# Documentation Standards

These standards cover bible pages, research, sources and preserved evidence.

## Single Source of Truth

| ID     | Rule                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-01 | **One fact, one owner.** All other places link. Repetition is a defect, even when accurate.                                                                                  |
| DOC-03 | Origin and evidence are separated: source (someone states it), measurement (we measured it), author decision (David decided). Research does not become a contract by itself. |
| DOC-04 | An author decision comes only from David, stands separate from measurement findings, and carries a date.                                                                     |

Owner by document type:

| Type             | Location                               | Owns                                                                                      |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Standards        | `docs/standards/`, `docs/development/` | Rules                                                                                     |
| AGENTS.md        | Repo root                              | Short duties and pointers                                                                 |
| README.md        | Repo root                              | Orientation, getting started, "Built with"                                                |
| Bible            | `src/routes/`                          | Design rules for readers                                                                  |
| Contract comment | on the public function                 | Units, mutation, copy semantics, errors ([C-23](CODING_STANDARDS.md#types-and-contracts)) |
| Tests            | `*.test.ts`                            | executable expectations                                                                   |
| Research         | `docs/research/`                       | Evidence, measurements, history                                                           |
| Private lab repo | the private lab repository             | Ideas, side quests, raw assets, prototypes; never linked from here                        |

## Bible Pages

| ID     | Rule                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-10 | On a bible page, give the rule and purpose beside its executable demo. Include measured metrics and units when they help the reader understand the result.                                                     |
| DOC-11 | Interventions, seed, and reset are visible. Every demo states one boundary case and one non-goal.                                                                                                              |
| DOC-12 | A demo consumes the library through public entries. Headless modules compute displayed metrics.                                                                                                                |
| DOC-13 | A headless scenario reproduces the demo’s measured result.                                                                                                                                                     |
| DOC-14 | Effect claims require a source or measurement. If both are absent, the statement is marked as intent. An image does not replace proof of access or function.                                                   |
| DOC-15 | Page copy and tables live with their chapter in `src/routes`.                                                                                                                                                  |
| DOC-16 | Before retiring a bible illustration, archive its screenshot and accompanying text together in the private lab. Verify that both can be opened before removing the obsolete step or route and its unused code. |

## Labs

| ID     | Rule                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| DOC-21 | Visual evidence for exploratory work lives in the private lab with the seed and camera. |

## Research

| ID     | Rule                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-30 | A research report records the question, hypothesis, method, revision, environment, inputs, seeds, metrics, result, limits and sources.                                                         |
| DOC-31 | Public research is one page per topic, named `NN-topic.md`. Numbered reports and measurement notes live in the private lab.                                                                    |
| DOC-32 | "The source says" and "our adaptation" stand separately. A claimed scientific algorithm requires an accurate source and verified implementation. Otherwise it is called "own simplified rule." |
| DOC-33 | A report states what it did not check. Unexecuted tests and browser checks are stated explicitly.                                                                                              |

## Experiments, Tables, Plates

| ID     | Rule                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-40 | Throwaway code lives outside the product tree: temporary directory or throwaway worktree. Scope, end, and deletion time are set upfront. No new dependency in the repo.                        |
| DOC-41 | Experiments, plates, raw data, and profiles live in the private lab repository. Only an accepted result enters this repo, as a condensed metric table and the verdict.                         |
| DOC-42 | The report includes the measurement contract per [PB-3](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty).                                                                              |
| DOC-43 | **Plates** hold seed, model time, camera, and scale constant. Every deviation is labeled. No cherry-picking the best seed. The caption states what the plate shows and what it does not prove. |
| DOC-44 | Blocked evidence remains open and is marked blocked in the report.                                                                                                                             |
| DOC-45 | Tables name unit and statistic in the column header. Numbers from different test domains are never summed together.                                                                            |

## Sources and Licenses

| ID     | Rule                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-50 | Source citation: author, title, place, year, DOI or URL. "Freely readable" is not a usage license. Attribution, licenses, and original titles remain unaltered. |
| DOC-51 | Third-party reference images and originals remain local and untracked (`.gitignore`). Only original works are published.                                        |
| DOC-52 | Before adding a dependency, record its license, size and benefit.                                                                                               |
| DOC-53 | Preserve license and attribution requirements when porting code or using references.                                                                            |
| DOC-54 | Open data carries its attribution in the derived work. Raw data remains local.                                                                                  |

## Frozen Evidence

| ID     | Rule                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| DOC-60 | Preserve historical measurement reports, frozen hashes and accepted expectations.                           |
| DOC-61 | A correction is a dated addendum in the same report. The old finding remains readable.                      |
| DOC-62 | If a path changes, references are updated, not contents.                                                    |
| DOC-63 | Current explanation stands on its own. Standards and Bible define behavior themselves and link to evidence. |

## Format

- Language: [NC-01](NAMING_CONVENTIONS.md#language). Short, clear sentences.
- Markdown is formatted with `bunx prettier --write`.
- Keep absolute home paths, secrets and email addresses out of repository prose.
- References are relative links to file and section.
