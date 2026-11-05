"use client";

import { useMemo, useState } from "react";
import { composeFromDescription, createSimulatedAdapters, runWorkflow, validateManifest, type RunResult, type SenseManifest } from "@mibyan/shared/sense";
import { useStudio } from "./shell";
import { Chain, Perms } from "./common";
import { publishCustomSense } from "@/lib/vision";

const EXAMPLES: [string, string][] = [
  ["When I inspect a machine, detect visible damage, and create a report", "عند فحص ماكينة اكتشف أي ضرر ظاهر وأنشئ تقريراً"],
  ["Read the text on signs aloud", "اقرأ لي النص في اللافتات بصوت عال"],
  ["Look at what is in front of me and describe it aloud", "صف لي ما أمامي بصوت عال"],
];

export function Composer() {
  const { tr, lang } = useStudio();
  const [text, setText] = useState(""); const [json, setJson] = useState(""); const [notes, setNotes] = useState<string[]>([]);
  const [err, setErr] = useState(""); const [res, setRes] = useState<RunResult | null>(null); const [sim, setSim] = useState<string[]>([]);
  const [damage, setDamage] = useState(true); const [saved, setSaved] = useState(""); const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => { try { const m = JSON.parse(json) as SenseManifest; return { m, issues: validateManifest(m) }; } catch (e) { return json ? { m: null, issues: [{ path: "json", message: e instanceof Error ? e.message : "Invalid JSON" }] } : null; } }, [json]);
  const generate = () => { setErr(""); setRes(null); setSaved(""); try { const c = composeFromDescription(text); setJson(JSON.stringify(c.manifest, null, 2)); setNotes(c.notes); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  const test = async () => {
    if (!parsed?.m || parsed.issues.length) return;
    const log: string[] = []; setRes(await runWorkflow(parsed.m, { granted: parsed.m.permissions, adapters: createSimulatedAdapters({ damage }, log), approve: async () => true })); setSim(log);
  };
  const save = async () => { if (!parsed?.m) return; setBusy(true); try { await publishCustomSense(parsed.m); setSaved(parsed.m.id); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } setBusy(false); };
  const m = parsed?.m;
  return (<>
    <h1>{tr("مُنشئ الحواس", "Sense Composer")}</h1>
    <p className="vs-sub">{tr("صف ما تريد أن تفهمه نظارتك، فيقترح المنشئ حاسة قابلة للتعديل والاختبار قبل التثبيت.", "Describe what your glasses should understand. The Composer proposes a Sense you can edit and test before installing.")}</p>
    <div className="vs-card">
      <textarea rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label={tr("وصف الحاسة", "Sense description")} placeholder={tr("مثال: عند فحص ماكينة اكتشف الضرر وأنشئ تقريراً", "e.g. When I inspect a machine, detect damage and create a report")} />
      <div className="vs-row">{EXAMPLES.map(([en, ar]) => <button key={en} className="vs-chip" style={{ cursor: "pointer", border: 0 }} onClick={() => setText(lang === "ar" ? ar : en)}>{lang === "ar" ? ar : en}</button>)}</div>
      <div className="vs-row"><button className="vs-btn pri" onClick={generate} disabled={text.trim().length < 8}>{tr("اقترح حاسة", "Propose a Sense")}</button>
        <span className="vs-chip">{tr("وضع القواعد: مطابقة كلمات، بدون نموذج ذكاء اصطناعي", "Rules mode: keyword matching, no AI model")}</span></div>
      {err && <div className="vs-note err" role="alert">{err}</div>}
    </div>
    {m && (<div className="vs-two" style={{ marginTop: 18 }}>
      <div className="vs-card"><h2>{tr("المقترح", "Proposal")}</h2><Chain m={m} /><Perms m={m} lang={lang} />
        {notes.map((n) => <div key={n} className="vs-note warn">{n}</div>)}
        {parsed.issues.length > 0 ? <div className="vs-note err" role="alert">{parsed.issues.map((i) => <div key={i.path + i.message}>{i.path}: {i.message}</div>)}</div> : <div className="vs-note good">{tr("المانيفست صالح.", "Manifest is valid.")}</div>}
        <label className="vs-row"><input type="checkbox" checked={damage} onChange={(e) => setDamage(e.target.checked)} />{tr("افترض أن المحاكاة تجد ضرراً", "Simulate finding damage")}</label>
        <div className="vs-row"><button className="vs-btn" disabled={!!parsed.issues.length} onClick={test}>{tr("تشغيل تجريبي (محاكاة)", "Test run (simulated)")}</button>
          <button className="vs-btn pri" disabled={!!parsed.issues.length || busy} onClick={save}>{tr("حفظ وتثبيت", "Save & install")}</button></div>
        {saved && <div className="vs-note good">{tr("تم التثبيت. ستظهر في تطبيق الجوال بنفس الحساب.", "Installed. It will appear in the mobile app on the same account.")}</div>}
        {res && (<div><div className="vs-note warn" style={{ marginBottom: 8 }}>{tr("محاكاة: لا كاميرا ولا نموذج ذكاء اصطناعي ولا حفظ حقيقي.", "SIMULATED: no camera, no AI model, nothing really saved.")}</div>
          <div className="vs-log"><b>{res.status}</b>{res.steps.map((s) => <div key={s.nodeId}>{s.status} · {s.nodeId} · {s.kind}{s.error ? ` — ${s.error}` : ""}</div>)}{sim.map((l) => <div key={l} style={{ color: "var(--mu)" }}>{l}</div>)}</div></div>)}
      </div>
      <div className="vs-card"><h2>{tr("المانيفست (قابل للتعديل)", "Manifest (editable)")}</h2>
        <textarea className="vs-code" rows={18} spellCheck={false} value={json} onChange={(e) => { setJson(e.target.value); setRes(null); }} aria-label="manifest JSON" /></div>
    </div>)}
  </>);
}
