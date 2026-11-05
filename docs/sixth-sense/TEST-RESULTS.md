# Test results (2026-11-05)

| Check | Result |
|---|---|
| `cd packages/shared && npm test` (node --test, 15 tests) | 14 pass / 0 fail |
| `tsc -p packages/shared` strict | pass |
| Migration on scratch Postgres 17 (stub `auth`, roles) | applies |
| RLS: user B cannot read A's shifts/records; cannot insert as A; cannot create `builtin` sense; owner reads own | pass |
| Migration rollback (`drop table …`) | pass |
| Hosted dev branch lmreuoemufdxhozssnbo: migration applied, RLS (B cannot read/forge A's rows, cannot create builtin, owner reads own) | pass (transaction rolled back) |
| Supabase security advisors on branch | no findings on `vision_*`; pre-existing findings on other tables (phone_otps, 4 email functions) |
| `tsc` web | pass |
| `tsc` app | 1 error, pre-existing and unrelated (`@/global.css` types; present without my changes) |
| `eslint` on `sense-adapters.ts`, `senses.tsx`, `tools.tsx`, `_layout.tsx` | pass |
| Senses screen on device/simulator, VoiceOver, RTL | NOT RUN (needs a dev build with the native module) |
| Meta glasses hardware, simulator, browser, Arabic/RTL UI | NOT RUN (no UI built) |

Caveat: the branch has no production data and a partial replay of production migrations (status MIGRATIONS_FAILED), so only the vision_* schema was exercised. Adapter code has not run on a device or simulator.
