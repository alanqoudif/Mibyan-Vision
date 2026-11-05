# Decisions

1. **Extend the existing monorepo** (`app/`, `web/`, `packages/shared`, `supabase/`) rather than create new apps. Reuse beats duplication.
2. **Sense engine lives in `@mibyan/shared/sense`** (pure TS, no I/O). Device, AI and storage are injected `Adapters`; a missing adapter throws `CapabilityError` — never a fake result.
3. **Not re-exported from the package root** so `app/` and `web/` typechecks are unaffected until they adopt it. Import via `@mibyan/shared/sense`.
4. **Node type-stripping for tests** (`node --test`, Node ≥ 22.18): no new dev dependencies. Consequence: relative imports use `.ts` extensions and no TS parameter properties/enums.
5. **Permissions are derived from the workflow** and must be declared in the manifest. Updates that add permissions are surfaced by `addedPermissions` for fresh consent.
6. **High-impact nodes (`action.create_task`) require explicit approval**; without an approver they are `blocked`, never run.
7. **Captured text/model output is data**: templating inserts values as plain strings; workflow structure cannot be altered by content.
8. **Handover is deterministic and evidence-linked**; only `consented` records enter it; output is `draft` until a human approves (`vision_handovers.status`).
9. **Production DB is not touched without authorization.** `mibyan main db` has live data (≈136 profiles, 3k+ messages). Migration is additive (`vision_*` only), validated on scratch Postgres.
10. **Per-user RLS first**; organization sharing is a separate later migration (existing `organizations` tables are Mibyan Chat/Core — not reused blindly).
11. **No code sandbox yet** → Code Sense execution stays disabled.
