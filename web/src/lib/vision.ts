"use client";

import { useEffect, useState } from "react";
import { validateManifest, type SenseManifest } from "@mibyan/shared/sense";
import { getSupabase } from "./supabase";

export type CatalogEntry = { id: string; kind: string; category: string; ownerId: string | null; manifest: SenseManifest; status: string };
export type Installation = { sense_id: string; version: string; enabled: boolean; granted_permissions: string[]; settings: Record<string, unknown> };

export function useSession() {
  const [state, setState] = useState<{ ready: boolean; userId: string | null; email: string | null }>({ ready: false, userId: null, email: null });
  useEffect(() => {
    let sb: ReturnType<typeof getSupabase>;
    try { sb = getSupabase(); } catch { void Promise.resolve().then(() => setState({ ready: true, userId: null, email: null })); return; }
    sb.auth.getSession().then(({ data }) => setState({ ready: true, userId: data.session?.user.id ?? null, email: data.session?.user.email ?? null }));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setState({ ready: true, userId: s?.user.id ?? null, email: s?.user.email ?? null }));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

export function useLang() {
  const [lang, setLangState] = useState<"ar" | "en">("ar");
  useEffect(() => { void Promise.resolve().then(() => { try { const v = localStorage.getItem("vision-lang"); if (v === "en" || v === "ar") setLangState(v); } catch {} }); }, []);
  const setLang = (l: "ar" | "en") => { setLangState(l); try { localStorage.setItem("vision-lang", l); } catch {} };
  return { lang, setLang, tr: (ar: string, en: string) => (lang === "ar" ? ar : en) };
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const { data, error } = await getSupabase().from("vision_senses").select("id,kind,category,owner_id,latest_version,vision_sense_versions(version,manifest,status)");
  if (error) throw new Error(error.message);
  const out: CatalogEntry[] = [];
  for (const row of data ?? []) {
    const v = (row.vision_sense_versions as { version: string; manifest: SenseManifest; status: string }[]).find((x) => x.version === row.latest_version);
    if (v) out.push({ id: row.id, kind: row.kind, category: row.category, ownerId: row.owner_id, manifest: v.manifest, status: v.status });
  }
  return out;
}

export async function loadInstallations(): Promise<Installation[]> {
  const { data, error } = await getSupabase().from("vision_sense_installations").select("sense_id,version,enabled,granted_permissions,settings");
  if (error) throw new Error(error.message);
  return (data ?? []) as Installation[];
}

async function uid() {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** Installs with exactly the permissions the person just reviewed and accepted. */
export async function installSense(m: SenseManifest, settings: Record<string, unknown>) {
  const user_id = await uid();
  const { error } = await getSupabase().from("vision_sense_installations").upsert(
    { user_id, sense_id: m.id, version: m.version, enabled: true, granted_permissions: m.permissions, settings, updated_at: new Date().toISOString() },
    { onConflict: "user_id,sense_id" },
  );
  if (error) throw new Error(error.message);
}

export async function setEnabled(senseId: string, enabled: boolean) {
  const { error } = await getSupabase().from("vision_sense_installations").update({ enabled, updated_at: new Date().toISOString() }).eq("sense_id", senseId);
  if (error) throw new Error(error.message);
}

export async function uninstallSense(senseId: string) {
  const { error } = await getSupabase().from("vision_sense_installations").delete().eq("sense_id", senseId);
  if (error) throw new Error(error.message);
}

/** Saves a user-created Sense (private to the owner) and installs it. Validates first. */
export async function publishCustomSense(m: SenseManifest) {
  const issues = validateManifest(m);
  if (issues.length) throw new Error(issues.map((i) => i.message).join("; "));
  const owner_id = await uid();
  const sb = getSupabase();
  const a = await sb.from("vision_senses").upsert({ id: m.id, owner_id, kind: "flow", category: m.category, is_public: false, latest_version: m.version });
  if (a.error) throw new Error(a.error.message);
  const b = await sb.from("vision_sense_versions").upsert({ sense_id: m.id, version: m.version, manifest: m, status: "validated" });
  if (b.error) throw new Error(b.error.message);
  await installSense(m, {});
}
