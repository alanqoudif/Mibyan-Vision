"use client";

import { useCallback, useEffect, useState } from "react";
import { missingCapabilities } from "@mibyan/shared/sense";
import { useStudio } from "./shell";
import { Chain, Perms } from "./common";
import { installSense, loadCatalog, loadInstallations, setEnabled, uninstallSense, type CatalogEntry, type Installation } from "@/lib/vision";

export function Marketplace() {
  const { tr, lang } = useStudio();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]); const [inst, setInst] = useState<Installation[]>([]);
  const [open, setOpen] = useState<string | null>(null); const [consent, setConsent] = useState(false); const [settings, setSettings] = useState<Record<string, string>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([loadCatalog(), loadInstallations()]).then(([c, i]) => { if (live) { setCatalog(c); setInst(i); setErr(""); } }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [tick]);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await refresh(); setOpen(null); setConsent(false); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } setBusy(false); };
  const shown = catalog.filter((c) => (c.manifest.name_en + c.manifest.name_ar + c.manifest.description_en).toLowerCase().includes(q.toLowerCase()));
  return (<>
    <h1>{tr("سوق الحواس", "Sense Marketplace")}</h1>
    <p className="vs-sub">{tr("ثبّت قدرات جديدة لنظارتك. كل حاسة تعرض أذوناتها قبل التثبيت، ولا تحصل على غيرها.", "Install new capabilities for your glasses. Every Sense shows its permissions before install and gets nothing else.")}</p>
    <input className="vs-in" style={{ maxWidth: 360, marginBottom: 18 }} placeholder={tr("ابحث…", "Search…")} aria-label={tr("بحث", "Search")} value={q} onChange={(e) => setQ(e.target.value)} />
    {err && <div className="vs-note err" role="alert" style={{ marginBottom: 14 }}>{err}</div>}
    <div className="vs-grid">{shown.map((c) => {
      const m = c.manifest; const i = inst.find((x) => x.sense_id === m.id); const isOpen = open === m.id;
      return (<article key={m.id} className={`vs-card ${i?.enabled ? "live" : ""}`}>
        <div className="vs-row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{lang === "ar" ? m.name_ar : m.name_en}</h2>
          <span className="vs-chip cy">{c.kind === "builtin" ? tr("رسمية", "Official") : tr("خاصة بك", "Yours")}</span></div>
        <p style={{ color: "var(--mu)", lineHeight: 1.6 }}>{lang === "ar" ? m.description_ar : m.description_en}</p>
        <Perms m={m} lang={lang} /><Chain m={m} />
        {i ? <div className="vs-row"><span className={`vs-chip ${i.enabled ? "ok" : ""}`}>{i.enabled ? tr("مفعّلة", "Active") : tr("مثبّتة", "Installed")}</span>
          <button className="vs-btn" disabled={busy} onClick={() => act(() => setEnabled(m.id, !i.enabled))}>{i.enabled ? tr("تعطيل", "Disable") : tr("تفعيل", "Enable")}</button>
          <button className="vs-btn ghost" disabled={busy} onClick={() => act(() => uninstallSense(m.id))}>{tr("إزالة", "Remove")}</button></div>
          : <button className="vs-btn pri" onClick={() => { setOpen(isOpen ? null : m.id); setConsent(false); setSettings({}); }}>{tr("تثبيت", "Install")}</button>}
        {isOpen && !i && (<div className="vs-note" style={{ display: "grid", gap: 10 }}>
          {m.settings_schema.map((f) => <label key={f.key}>{lang === "ar" ? f.label_ar : f.label_en}<input className="vs-in" value={settings[f.key] ?? ""} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })} /></label>)}
          <label className="vs-row"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {tr("أوافق على منح هذه الحاسة الأذونات المذكورة أعلاه فقط.", "I allow this Sense exactly the permissions listed above, nothing more.")}</label>
          <button className="vs-btn pri" disabled={!consent || busy} onClick={() => act(() => installSense(m, settings))}>{tr("تأكيد التثبيت", "Confirm install")}</button>
        </div>)}
        {missingCapabilities(m.workflow, { capture: async () => ({ imageRef: "", source: "demo_session" }), describe: async () => ({ text: "" }), speak: async () => {} }).length > 0 &&
          <span className="vs-chip bad">{tr("بعض خطواتها غير متاحة على الجوال بعد", "Some steps are not available on mobile yet")}</span>}
      </article>);
    })}</div>
  </>);
}
