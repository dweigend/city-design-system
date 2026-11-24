# Focus

A composition supplies ordered choices, contributed subsystem rows and any required row keys.
Each choice gives a label, an optional analysis mode and the subsystems it highlights.
The resolver snapshots its inputs and validates row coverage at construction.
An unknown subsystem raises FocusPolicyError. An unknown choice raises RangeError.
Menu choices keep their input order, dropping absent subjects and duplicate drawings.
The fixed example uses a subject and backdrop, with a Detail choice that hides the backdrop.
