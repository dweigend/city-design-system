# Derive

Memoizes a derived value for an object scope, a `Key` tuple and a string or tuple revision.

- Scopes are weakly held. Each key retains its most recent successful result by reference.
- A changed revision recomputes on the next read. Returning to an earlier revision recomputes
  again. A failed computation leaves the previous result intact.
- The optional per-scope limit evicts keys in insertion order. It defaults to unlimited.
- The caller changes the revision when inputs to the derivation change.

Run the fixed edit and undo example in [example.ts](example.ts).
