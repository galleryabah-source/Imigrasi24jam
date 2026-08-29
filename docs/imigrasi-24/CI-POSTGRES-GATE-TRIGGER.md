# PostgreSQL CI Gate Trigger

This marker commit intentionally changes documentation on the foundation branch so the PostgreSQL Foundation workflow's `push` trigger executes against the current branch state.

The resulting workflow run is the authoritative evidence for the database foundation gate. A source file existing in the repository is not considered a test result.
