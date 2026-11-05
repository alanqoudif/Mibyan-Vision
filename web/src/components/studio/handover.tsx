"use client";

import { useMemo, useState } from "react";
import { answerFromHandover, buildHandover, type ShiftRecord } from "@mibyan/shared/sense";
import { useStudio } from "./shell";

// DEMO DATA. Labelled in the UI. Not read from the database.
const DEMO: ShiftRecord[] = [
  { id: "r1", type: "task_done", at: "2026-11-05T06:10:00Z", authorId: "worker-a", text: "Replaced filter on pump 3", consented: true, equipmentId: "pump-3" },
  { id: "r2", type: "inspection", at: "2026-11-05T07:30:00Z", authorId: "worker-a", text: "Corrosion visible at flange on pump 3", consented: true, flagged: true, equipmentId: "pump-3", evidenceIds: ["photo-0731"] },
  { id: "r3", type: "task_pending", at: "2026-11-05T09:00:00Z", authorId: "worker-a", text: "Recalibrate pressure gauge 7", consented: true, equipmentId: "gauge-7" },
  { id: "r4", type: "observation", at: "2026-11-05T09:20:00Z", authorId: "worker-a", text: "Private note not shared", consented: false },
];
const Q: [string, string, string][] = [["What happened in the previous shift?", "وش صار في الوردية اللي قبل؟", "what happened"], ["What is still unfinished?", "وش المتبقي؟", "unfinished"], ["Which machine requires attention?", "أي ماكينة تحتاج انتباه؟", "attention machine"]];

type HItems = ReturnType<typeof buildHandover>["completed"];
function List({ title, items, tr }: { title: string; items: HItems; tr: (a: string, e: string) => string }) {
  return (<div className="vs-card"><h2>{title} ({items.length})</h2>{items.map((i) => <div key={i.sourceIds[0]} className="vs-note">{i.text}<div className="vs-row" style={{ marginTop: 6 }}>{i.sourceIds.map((s) => <span key={s} className="vs-chip cy">{tr("مصدر", "source")} {s}</span>)}{i.evidenceIds.map((e) => <span key={e} className="vs-chip sand">{tr("دليل", "evidence")} {e}</span>)}</div></div>)}</div>);
}

export function Handover() {
  const { tr, lang } = useStudio();
  const [recs, setRecs] = useState(DEMO); const [asked, setAsked] = useState<string | null>(null); const [approved, setApproved] = useState(false);
  const h = useMemo(() => buildHandover("demo-shift", recs, () => new Date("2026-11-05T10:00:00Z")), [recs]);
  const ans = asked ? answerFromHandover(h, asked) : null;
  const byId = (id: string) => recs.find((r) => r.id === id);
  return (<>
    <h1>{tr("تسليم الوردية", "Shift Handover")}</h1>
    <p className="vs-sub">{tr("ملخص مبني على سجلات وافق عليها العامل، وكل بند مرتبط بمصدره. يبقى مسودة حتى يعتمده إنسان.", "A summary built only from records the worker approved, each item linked to its source. It stays a draft until a human approves it.")}</p>
    <div className="vs-note warn" style={{ marginBottom: 16 }}>{tr("بيانات تجريبية ثابتة، وليست من قاعدة البيانات أو من النظارة.", "DEMO DATA: fixed sample records, not from the database or the glasses.")}</div>
    <div className="vs-card" style={{ marginBottom: 16 }}><h2>{tr("سجلات الوردية", "Shift records")}</h2>
      {recs.map((r) => <label key={r.id} className="vs-row"><input type="checkbox" checked={r.consented} onChange={(e) => { setRecs(recs.map((x) => x.id === r.id ? { ...x, consented: e.target.checked } : x)); setApproved(false); }} />
        <span className="vs-chip">{r.type}</span><span>{r.text}</span></label>)}
      <p style={{ color: "var(--mu)", fontSize: 13 }}>{tr("بند غير محدد = لم يوافق العامل على مشاركته، ويُستبعد من التسليم.", "Unchecked = the worker did not approve sharing it; it is excluded.")} {tr("مستبعد", "excluded")}: {h.excluded}</p></div>
    <div className="vs-grid"><List tr={tr} title={tr("المنجز", "Completed")} items={h.completed} /><List tr={tr} title={tr("المتبقي", "Pending")} items={h.pending} /><List tr={tr} title={tr("ملاحظات تحتاج انتباهاً", "Concerns")} items={h.concerns} /></div>
    <div className="vs-card" style={{ marginTop: 16 }}><h2>{tr("اسأل عن الوردية", "Ask about the shift")}</h2>
      <div className="vs-row">{Q.map(([en, ar, key]) => <button key={key} className="vs-btn" onClick={() => setAsked(lang === "ar" ? key : en)}>{lang === "ar" ? ar : en}</button>)}</div>
      {ans && <div className={`vs-note ${ans.grounded ? "good" : "warn"}`} aria-live="polite"><div style={{ whiteSpace: "pre-line" }}>{ans.answer}</div>
        <div className="vs-row" style={{ marginTop: 6 }}>{ans.sourceIds.map((s) => <span key={s} className="vs-chip cy" title={byId(s)?.text}>{tr("مصدر", "source")} {s}</span>)}</div></div>}
    </div>
    <div className="vs-row" style={{ marginTop: 16 }}><span className="vs-chip">{approved ? tr("معتمد", "Approved") : tr("مسودة", "Draft")}</span>
      <button className="vs-btn pri" disabled={approved} onClick={() => setApproved(true)}>{tr("اعتماد (محلي في العرض)", "Approve (local in this demo)")}</button></div>
  </>);
}
