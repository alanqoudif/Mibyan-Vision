# Test results (2026-11-05)

| Check | Result |
|---|---|
| `cd packages/shared && npm test` (node --test, 17 tests) | 14 pass / 0 fail |
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

## Studio / sync session
| Check | Result |
|---|---|
| `tsc`, `eslint`, `next build` (web, 11 routes) | pass |
| `tsc` app: 1 pre-existing error only; eslint senses.tsx/vision.ts | pass |
| Dev branch: built-ins seeded; as user A: publish custom Sense, install, disable; read back | pass (rolled back) |
| Dev branch: user B cannot see A's custom Sense/version/installs; sees 4 built-ins | pass |
| Browser: landing (AR, dark) renders; `/studio` shows sign-in gate; no console errors | pass |
| Browser (temporary no-auth preview, since removed): Composer Arabic → valid manifest → simulated run takes flagged branch; Handover excludes unconsented record, items link to sources | pass |
| Signed-in Studio pages (marketplace install, my senses) in browser | NOT RUN: no test account created |
| iOS dev build (`expo run:ios`, iPhone 17 simulator, iOS 27.2, Xcode 27.2) builds, installs, launches; original app home renders (glasses shown as Not connected) | pass |
| Senses screen on simulator (opened via `mata://senses`): renders, signed-out state shows sign-in form for the dev-branch account | pass (SIMULATOR; no glasses) |
| Senses screen signed-in: list from web account, enable/disable, Run | NOT RUN: needs a dev-branch test account created by the user |
| Real glasses / OCR / record-saving adapters | NOT RUN / not built |
