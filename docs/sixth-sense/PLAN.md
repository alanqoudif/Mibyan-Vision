# Sixth Sense — Plan

Statuses: Not Started · In Progress · Implemented · Verified · Blocked. "Verified" means actually run.

| # | Workstream | Status | Notes |
|---|---|---|---|
| 0 | Reconnaissance | Verified | See ARCHITECTURE.md §Discovery |
| 1 | Sense manifest, validator, permission model (`packages/shared/src/sense`) | Verified | 14 node:test tests, strict tsc |
| 2 | Workflow engine (executable, permissions, approval gate, budgets, timeouts) | Verified | Unit tests with injected adapters; no real device/AI adapter yet |
| 3 | Built-in Senses (4) seeded to dev branch from the catalog (migration 20261105130000) | Verified on dev branch | Real adapters: only capture/describe/speak on mobile |
| 3b | Composer (rules mode, no LLM) → valid manifest | Verified (tests + browser) | |
| 4 | Sense Handover builder + grounded Q&A | Verified (deterministic core) | No model narrative layer, no UI |
| 5 | Supabase migration `vision_*` core + built-in seed | **Applied to production** (`hohkvhffpcfchbrtvwiu`) after pre-flight; see PRODUCTION-MIGRATION.md. Verified: no non-Vision object changed; RLS probe passed | Dev branch no longer needed for this |
| 6 | Edge Function: run Sense / model gateway | Not Started | Runs happen on-device via existing `mata-assist`; needs production deploy authorization |
| 7 | Mobile account sync (`app/src/lib/vision.ts`) + Senses screen reading the web account's installs, running with the permissions granted at install | Implemented, typechecked + linted, NOT run on simulator/device | Adapters: (`app/src/lib/sense-adapters.ts`: glasses/phone capture, `mata-assist` describe, speak, user approval) | Implemented, typechecked + linted, NOT run on device | Senses screen `app/src/app/senses.tsx` (modal from Tools): Implemented, typechecked + linted, NOT run on device/simulator |
| 8 | Web Vision Studio (`/studio`: Overview, Marketplace + install/consent, Composer w/ editable manifest + simulated test run, My Senses, Handover demo) | Implemented; lint/tsc/`next build` pass; Composer + Handover checked in browser; authenticated pages NOT exercised (no test account) | Visual node editor, dashboards: Not Started |
| 9 | Public marketing site (`/`) | Implemented by subagent; rendered in browser (AR/RTL, dark); lower sections, mobile width, EN not reviewed | |
| 10 | Code Studio / SDK sandbox | Not Started | Arbitrary code execution stays disabled until a sandbox exists |
| 11 | Orgs, dashboards, memory, analytics | Not Started | |

## Next step (resume here)
1. Dev client is built and installed on the iPhone 17 simulator (`cd app && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device <udid>`; the locale vars are required for CocoaPods). Create an account on the dev branch, sign in on web and in the app's Senses screen.
2. Create a test account on the dev branch, sign in on web (`npm run dev:web`), install + compose a Sense, refresh in the app: this completes the web→mobile journey test (DB path already verified with impersonated JWTs).
3. Production: apply both vision migrations to `mibyan main db` only with explicit approval; delete dev branch afterwards.
4. Then: visual workflow editor (React Flow), dashboards, real OCR/record/notify adapters, realtime sync.
