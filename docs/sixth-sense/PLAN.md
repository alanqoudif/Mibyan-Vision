# Sixth Sense — Plan

Statuses: Not Started · In Progress · Implemented · Verified · Blocked. "Verified" means actually run.

| # | Workstream | Status | Notes |
|---|---|---|---|
| 0 | Reconnaissance | Verified | See ARCHITECTURE.md §Discovery |
| 1 | Sense manifest, validator, permission model (`packages/shared/src/sense`) | Verified | 14 node:test tests, strict tsc |
| 2 | Workflow engine (executable, permissions, approval gate, budgets, timeouts) | Verified | Unit tests with injected adapters; no real device/AI adapter yet |
| 3 | Built-in Senses (Scene Narrator, Read Anything, Equipment Inspection, Shift Note) | Verified (manifests + simulated runs) | Real adapters not wired |
| 4 | Sense Handover builder + grounded Q&A | Verified (deterministic core) | No model narrative layer, no UI |
| 5 | Supabase migration `vision_*` core | Verified on dev branch `vision-sixth-sense` (ref lmreuoemufdxhozssnbo); NOT on production | Local Postgres + hosted branch RLS tests pass |
| 6 | Edge Function: run Sense / model gateway | Not Started | Needs production deploy authorization |
| 7 | Mobile adapters (`app/src/lib/sense-adapters.ts`: glasses/phone capture, `mata-assist` describe, speak, user approval) | Implemented, typechecked + linted, NOT run on device | Senses screen `app/src/app/senses.tsx` (modal from Tools): Implemented, typechecked + linted, NOT run on device/simulator |
| 8 | Web: Studio shell, Marketplace, Composer, Workflow editor, Handover UI | Not Started | `web/` is Next 16 with only plugins/pharmacy pages today |
| 9 | Public marketing site | Not Started | |
| 10 | Code Studio / SDK sandbox | Not Started | Arbitrary code execution stays disabled until a sandbox exists |
| 11 | Orgs, dashboards, memory, analytics | Not Started | |

## Next step (resume here)
1. Run the Senses screen on a dev build (`npx expo run:ios`), test Scene Narrator and Read Anything with the glasses and with the phone-camera fallback; check VoiceOver, Arabic/RTL.
2. Seed built-in Senses into the branch (`vision_senses`/`vision_sense_versions`) and add install/enable UI writing `vision_sense_installations`.
3. Decide on applying the migration to production (`mibyan main db`) — needs explicit go-ahead. Delete the dev branch when done (billed $0.01344/h).
4. Web: Marketplace + install flow.
