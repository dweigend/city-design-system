# View modes example

Kind: example
Subject: logic/view-modes
Purpose: Chooses one of the landscape chapter's five views on the same seeded terrain.
Exports: resolveExampleView
Outputs: A frozen camera and display selection.
Input: request | ViewRequest | — | IDs allowed by the landscape policy | Landscape policy defaults

The landscape chapter owns the view policy. The resolver validates each selection before the stage applies it.
