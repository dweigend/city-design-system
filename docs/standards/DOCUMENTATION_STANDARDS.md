# Documentation Standards

As of 2026-11-12. Draft; legend, source abbreviations, and status are in [README](README.md).

Owner for: single source of truth, status labeling, bible pages, labs, research, experiments with tables and plates, sources and licenses, frozen evidence.

## Single Source of Truth and Status

| ID     | Rule                                                                                                                                                                                               | Source · Auth.                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| DOC-01 | **One fact, one owner.** All other places link. Repetition is a defect, even when accurate.                                                                                                        | AR §Ten architectural principles (Single source of truth) · N |
| DOC-02 | Every normative statement carries its status: **available** (delivered and verified), **target** (accepted, not delivered), or **proposal**. A folder, plan, or standard is not proof of delivery. | AR §Binding domain layout; PL · N                             |
| DOC-03 | Origin and evidence are separated: source (someone states it), measurement (we measured it), author decision (David decided). Research does not become a contract by itself.                       | LA; PL; Transfer · N                                          |
| DOC-04 | An author decision comes only from David, stands separate from measurement findings, and carries a date.                                                                                           | 100 §Results of the Experiments; KE E4 · V                    |
| DOC-05 | Dates are absolute: "As of 2026-11-12," never "today" or "recently."                                                                                                                               | Current practice in the research notes · V                    |

Owner by document type:

| Type             | Location                                                           | Owns                                                                                      |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Standards        | `docs/standards/`, `docs/development/`                             | Rules                                                                                     |
| AGENTS.md        | Repo root                                                          | Short duties and pointers                                                                 |
| README.md        | Repo root                                                          | Orientation, getting started, "Built with"                                                |
| Bible            | `src/lib/catalog/data/`, pages                                     | Design rules for readers                                                                  |
| Contract comment | on the public function                                             | Units, mutation, copy semantics, errors ([C-23](CODING_STANDARDS.md#types-and-contracts)) |
| Tests            | `*.test.ts`                                                        | executable expectations                                                                   |
| Research         | `docs/research/` (private lab; only condensed outcomes are public) | Evidence, measurements, history                                                           |
| Private lab repo | private sibling repo `city-design-lab`                             | Ideas, side quests, raw assets, prototypes; never linked from here                        |

## Bible Pages

Translation of the library model pattern (question, visible mechanism, targeted intervention, headless comparison). There it is a proposal; here too.

| ID     | Rule                                                                                                                                                                                            | Source · Auth.                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| DOC-10 | Structure of a rule on a bible page: **Rule → Purpose → executable demo → metric with unit and budget → source and status.**                                                                    | Transfer addendum; PR §Model pattern · V |
| DOC-11 | Interventions, seed, and reset are visible. Every demo states one boundary case and one non-goal.                                                                                               | Transfer addendum · V                    |
| DOC-12 | A demo is a consumer of the catalog contract. It contains no domain logic of its own and no CSS in the page. Displayed numbers come from `logic/` ([C-42](CODING_STANDARDS.md#reference-code)). | AG; UI §Binding UI authoring rules · D\* |
| DOC-13 | Every demo has a headless counterpart: an assertable scenario in `logic/` that reproduces the displayed metric.                                                                                 | PR §Model pattern (step 4) · V           |
| DOC-14 | Effect claims require a source or measurement. If both are absent, the statement is marked as intent. An image does not replace proof of access or function.                                    | 99 No. 3; 103 · V                        |
| DOC-15 | Bible copy and tables live as data in `data/`. Components render them.                                                                                                                          | Current practice (`data/kapitel.ts`) · V |

## Labs

| ID     | Rule                                                                                                                                    | Source · Auth.        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| DOC-20 | A lab (`labor/L*.svelte`, route `/labor`) is an interactive part of the product. It uses public contracts and follows all standards.    | Transfer addendum · V |
| DOC-21 | Visual evidence of a lab lives in the private lab repo under `research/labor/<topic>/`. A README there states seed, camera, and status. | Transfer addendum · V |

## Research

| ID     | Rule                                                                                                                                                                                                                                    | Source · Auth.                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| DOC-30 | Header of each report: date/status, type (research, synthesis, measurement, review), author, authority. Contents: question, hypothesis, method, revision and environment, inputs and seeds, metrics, result, limits, decision, sources. | Transfer addendum · V                           |
| DOC-31 | Filename `NN-topic.md` with unique number. New reports take the next free number. Existing files are not renamed. Current: 104–106 are duplicated due to parallel threads.                                                              | Current practice; NC §Spelling · V              |
| DOC-32 | "The source says" and "our adaptation" stand separately. A claimed scientific algorithm requires an accurate source and verified implementation. Otherwise it is called "own simplified rule."                                          | 96 Reading key; PR §Model pattern; Transfer · V |
| DOC-33 | A report states what it did not check. Unexecuted tests and browser checks are stated explicitly.                                                                                                                                       | CS §Refactoring 6; LA · N                       |

## Experiments, Tables, Plates

| ID     | Rule                                                                                                                                                                                                                                                    | Source · Auth.                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| DOC-40 | Throwaway code lives outside the product tree: temporary directory or throwaway worktree. Scope, end, and deletion time are set upfront. No new dependency in the repo.                                                                                 | 100 §5 · V                                    |
| DOC-41 | Only the following enter the lab repo: one condensed metric table, at most one image plate (up to 1600 px), and the verdict accepted or rejected, under `research/labor/<experiment>/`. No experiment code, raw data, intermediate images, or profiles. | 100 §5 · V                                    |
| DOC-42 | The report includes the measurement contract per [PB-3](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty).                                                                                                                                       | KE Measurement contract · V                   |
| DOC-43 | **Plates** hold seed, model time, camera, and scale constant. Every deviation is labeled. No cherry-picking the best seed. The caption states what the plate shows and what it does not prove.                                                          | PR §Rules learned in review; Transfer; KE · V |
| DOC-44 | Blocked evidence remains open and is marked blocked in the report.                                                                                                                                                                                      | KE E3 · V                                     |
| DOC-45 | Tables name unit and statistic in the column header. Numbers from different test domains are never summed together.                                                                                                                                     | KE Measurement contract · V                   |

## Sources and Licenses

| ID     | Rule                                                                                                                                                                    | Source · Auth.                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| DOC-50 | Source citation: author, title, place, year, DOI or URL. "Freely readable" is not a usage license. Attribution, licenses, and original titles remain unaltered.         | 96 Reading key; NC §Profiles · N |
| DOC-51 | Third-party reference images and originals remain local and untracked (`.gitignore`). Only original works are published.                                                | Project `.gitignore` · N         |
| DOC-52 | Before every new dependency: license, size, benefit. The license list in 100 E4 lists MIT, ISC, BSL; `Unlicense` is missing there (KE E7). David will clarify the list. | 100 E4; KE E7 · V                |
| DOC-53 | Only ideas and contracts are adopted from the library and earlier projects — no code and no third-party-licensed models.                                                | 100 §2.1 · V                     |
| DOC-54 | Open data carries its attribution in the derived work. Raw data remains local.                                                                                          | 102 §Sources and Licenses · N    |

## Frozen Evidence

| ID     | Rule                                                                                                                                                                                                                                                                                                                                     | Source · Auth.                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| DOC-60 | Historical findings, measurement reports, frozen hashes, and accepted expectations are never rewritten, not even for language cleanup. Exception, David 2026-11-17: one translation into English with unified terminology; measurements, hashes, technical meaning, accepted expectations and original source quotations stay unchanged. | NC §Profiles; PL · N                                   |
| DOC-61 | A correction is a dated addendum in the same report. The old finding remains readable.                                                                                                                                                                                                                                                   | Current practice (100 §Results of the Experiments) · V |
| DOC-62 | If a path changes, references are updated, not contents.                                                                                                                                                                                                                                                                                 | NC §Repository structure · N                           |
| DOC-63 | Current explanation stands on its own. Standards and Bible define behavior themselves and link to evidence.                                                                                                                                                                                                                              | NC §Profiles · N                                       |

## Format

- Language: [NC-01](NAMING_CONVENTIONS.md#language). Short, clear sentences.
- Markdown is formatted with `bunx prettier --write`.
- No absolute home paths, no secrets, no email addresses. Library paths start with `city-library/`.
- References are relative links to file and section.
