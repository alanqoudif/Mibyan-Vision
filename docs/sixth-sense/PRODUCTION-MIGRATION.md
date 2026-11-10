# Production migration record — Sixth Sense `vision_*` (2026-11-05)

**Target:** Supabase project `hohkvhffpcfchbrtvwiu` ("mibyan main db", PG 17.6). Confirmed as the Mibyan Vision backend: it hosts the deployed `mata-assist`, `mata-live`, `mata-helper`, `mata-tts` functions and `mata_*` tables that the app calls.
**Authorization:** explicit instruction from the project owner in chat to apply the tested additive migration after verification.

## Applied (in order)
1. `vision_sixth_sense_core`: 7 new tables (`vision_senses`, `vision_sense_versions`, `vision_sense_installations`, `vision_shifts`, `vision_records`, `vision_handovers`, `vision_audit_logs`), their indexes, RLS policies, grants.
2. `vision_seed_builtin_senses`: inserts 4 built-in Senses into the new tables.

## Pre-flight (all passed)
- No existing `vision_*` tables/indexes; no policy-name collisions; `pgcrypto` present.
- SQL scan: no DROP/DELETE/TRUNCATE/ALTER of existing objects, no functions, triggers or extensions. FKs only reference `auth.users(id)` (cascade applies to the new tables' rows only).
- Found: this project's default privileges grant ALL (incl. TRUNCATE) to `anon`/`authenticated` on new tables, and RLS does not restrict TRUNCATE. The migration therefore revokes everything from `anon, authenticated` on the new tables and re-grants only what is needed.
- Local rehearsal on scratch Postgres with production-like default privileges: anon 0 privileges, authenticated no TRUNCATE/REFERENCES/TRIGGER, RLS on, seed loads.

## Post-apply verification
Fingerprint of everything non-Vision, identical before and after: 441 tables, RLS-flag hash, 378 policies, policy-definition hash, grants hash, 363 functions, 136 auth users.
New objects: 7 tables, RLS on all, anon grants 0, no dangerous authenticated privileges, 4 built-ins.
RLS probe on production (two existing accounts, transaction rolled back): owner sees own install/record + 4 built-ins; other user sees 0 of them, still sees 4 built-ins; forged insert, fake built-in and TRUNCATE all denied. After rollback: 4 senses, 0 installs/records/shifts.

## Recovery
Only new objects were added, so recovery is dropping them. **Run only after confirming no user data must be kept** (check `select count(*)` on each table first):
```sql
drop table public.vision_audit_logs, public.vision_handovers, public.vision_records, public.vision_shifts,
  public.vision_sense_installations, public.vision_sense_versions, public.vision_senses;
delete from supabase_migrations.schema_migrations where name in ('vision_sixth_sense_core','vision_seed_builtin_senses');
```
Other Mibyan apps neither read nor write these tables. Project-level PITR/backups were not inspected from here; confirm in the Supabase dashboard.

## Not done / open
- `mata_plugins`, `mata_pharmacy_items` etc. from repo migration `20261103181430_plugin_platform.sql` are NOT in production (not part of this task, not applied).
- Web Google OAuth requires `http://localhost:3111/auth/callback` (and the production site URL) in the Supabase Auth redirect allow-list; not verifiable from here.
