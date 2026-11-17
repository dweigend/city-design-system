# Development

How this repository is built and delivered. Not the design bible itself (that lives on the website), not research (`docs/research/`) and not the binding code rules (`docs/standards/`).

## What belongs here

- **Workflow:** how changes reach `main`, see [git-workflow.md](git-workflow.md).
- **Contracts:** one `<topic>-contract.md` per new public contract phase, with its 4–5 accepted examples ([C-43](../standards/CODING_STANDARDS.md#reference-code)).
- **Evidence:** measurements and sign-offs a contract depends on, in `verification/`, frozen per [DOC-60–63](../standards/DOCUMENTATION_STANDARDS.md#frozen-evidence).

## What does not

- Research, explorations and comparison plates: `docs/research/`.
- Agent templates, prompts and checklists: local skills (`git-delivery`, `model-routing`), never tracked.
- Notes and images for local use only: `_lokal/`.

A file here is removed once its contract is fully absorbed into code and standards.
