# Architecture

## Discovery (verified by inspection, 2026-11-05)
- Monorepo (npm workspaces): `app/` Expo SDK 58 / RN 0.88 / Expo Router; `web/` Next 16 (auth callback, plugins, pharmacy); `packages/shared`; `supabase/`.
- Glasses: native Expo module `app/modules/mubayan-glasses` (Swift) using Meta Wearables Device Access Toolkit (MWDATCore/MWDATCamera). Exposes registration state, camera permission, `capturePhoto`, `captureFrame`, live mode, obstacle sensor, on-device OCR. **iOS only; null in Expo Go/web → phone-camera fallback.** Mic/audio output on the glasses go through the phone's Bluetooth route; no custom wake word, display or background capture is claimed.
- Supabase project `mibyan main db` (ref hohkvhffpcfchbrtvwiu): Mibyan Chat/Core/Omni/Tenders tables plus `mata_*` (sessions, helper, plugins, pharmacy, settings, device links). Edge functions: `mata-assist` (vision/assistant), `mata-live`, `mata-tts`, `mata-helper`; `mata-link-device` exists in repo (not in deployed list at time of check).
- Existing plugin system (`mata_plugins`, prompt-instruction plugins with 4 capabilities) — Sense is a superset; migration path is a later task.
- Not found: CI config, web tests, any sandbox infrastructure. `build/` contains a committed .xcarchive (should be gitignored).

## Sense model
`SenseManifest` → `Workflow` (DAG of typed nodes) → `runWorkflow(manifest, {granted, adapters, approve, limits})` → `RunResult` (per-step log).
Checks before run: workflow valid (one trigger, no cycles/unknown refs/unreachable), each node's permission ∈ manifest.permissions ∩ user-granted.
Budgets: maxSteps, maxAiCalls, nodeTimeoutMs, totalTimeoutMs. Failures stop the run (fail-fast) and are logged.

## Data (`vision_*`, migration 20261105120000)
senses → sense_versions (manifest jsonb) → sense_installations (per user; `granted_permissions`, `settings`) ; shifts → records (consent flag, source label) → handovers (draft/approved) ; audit_logs. RLS: own-rows only; built-ins readable by all; users cannot create `builtin`.

## Planned (not built)
GlassesAdapter {meta, phone, upload, demo}; server-side run gateway (keys stay in Edge Functions); Realtime sync of installations to mobile; web Studio.
