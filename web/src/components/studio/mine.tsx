"use client";

import { useCallback, useEffect, useState } from "react";
import { useStudio } from "./shell";
import { Chain, Perms } from "./common";
import { loadCatalog, loadInstallations, setEnabled, uninstallSense, type CatalogEntry, type Installation } from "@/lib/vision";
import Link from "next/link";

export function MySenses() {
  const { tr, lang } = useStudio();
  const [rows, setRows] = useState<{ c: CatalogEntry; i: Installation }[]>([]); const [err, setErr] = useState(""); const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([loadCatalog(), loadInstallations()])
      .then(([c, i]) => { if (live) { setRows(i.flatMap((x) => { const e = c.find((y) => y.id === x.sense_id); return e ? [{ c: e, i: x }] : []; })); setErr(""); } })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [tick]);
  return (<>
    <h1>{tr("حواسي", "My Senses")}</h1>
    <p className="vs-sub">{tr("هذه الحواس مرتبطة بحسابك، وتظهر نفسها في تطبيق الجوال.", "These Senses belong to your account and appear in the mobile app.")}</p>
    {err && <div className="vs-note err" role="alert">{err}</div>}
    {ready && !rows.length && <div className="vs-note">{tr("لا توجد حواس مثبّتة. ", "No Senses installed. ")}<Link href="/studio/marketplace" style={{ color: "var(--cy)" }}>{tr("تصفح السوق", "Browse the marketplace")}</Link></div>}
    <div className="vs-grid">{rows.map(({ c, i }) => (
      <article key={c.id} className={`vs-card ${i.enabled ? "live" : ""}`}>
        <h2 style={{ margin: 0 }}>{lang === "ar" ? c.manifest.name_ar : c.manifest.name_en}</h2><Perms m={c.manifest} lang={lang} /><Chain m={c.manifest} />
        <div className="vs-row"><span className={`vs-chip ${i.enabled ? "ok" : ""}`}>{i.enabled ? tr("مفعّلة", "Active") : tr("معطّلة", "Disabled")}</span>
          <span className="vs-chip">v{i.version}</span>
          <button className="vs-btn" onClick={async () => { await setEnabled(c.id, !i.enabled); await refresh(); }}>{i.enabled ? tr("تعطيل", "Disable") : tr("تفعيل", "Enable")}</button>
          <button className="vs-btn ghost" onClick={async () => { await uninstallSense(c.id); await refresh(); }}>{tr("إزالة", "Remove")}</button></div>
      </article>))}</div>
  </>);
}
