# Reference Folder Policy

The `reference/` directory is NOT part of this codebase. It holds third-party or exploratory material kept purely for reference (for example `reference/signature_pad`). It is gitignored via `reference/*`.

It is unapproved, work-in-progress reference material that may still have value; it stays untouched until the maintainer tests and approves what to do with it.

Rules for all agent work:

- Do NOT lint, format, type-check, or run tests against anything under `reference/`.
- Do NOT modify, refactor, rename, move, or delete files in `reference/`.
- Do NOT import from `reference/` in shipped code, and do NOT include it in spec tasks, builds, or verification steps.
- Treat it as read-only reference material only.
- When reporting lint/build/test results, exclude `reference/` and do not flag issues found there.
