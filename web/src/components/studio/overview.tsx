"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudio } from "./shell";
import { loadCatalog, loadInstallations } from "@/lib/vision";

export function Overview() {
  const { tr } = useStudio();
  const [n, setN] = useState<{ cat: number; inst: number; on: number } | null>(null); const [err, setErr] = useState("");
  useEffect(() => { Promise.all([loadCatalog(), loadInstallations()]).then(([c, i]) => setN({ cat: c.length, inst: i.length, on: i.filter((x) => x.enabled).length })).catch((e) => setErr(String(e.message ?? e))); }, []);
  const steps: [string, string, string, string][] = [
    ["/studio/composer", "١. أنشئ حاسة", "1. Compose a Sense", "صف ما تريد، عدّل المانيفست، اختبره بمحاكاة، ثم ثبّته."],
    ["/studio/marketplace", "٢. ثبّت من السوق", "2. Install from the marketplace", "راجع الأذونات ووافق عليها صراحةً."],
    ["/studio/senses", "٣. أدرها", "3. Manage them", "فعّل أو عطّل. التغييرات تصل إلى تطبيق الجوال بنفس الحساب."],
    ["/studio/handover", "٤. تسليم الوردية", "4. Shift handover", "ملخص مرتبط بالمصادر وبموافقة العامل (بيانات تجريبية)."],
  ];
  return (<>
    <h1>{tr("مركز القيادة", "Command Center")}</h1>
    <p className="vs-sub">{tr("طبقة ذكاء قابلة للبرمجة لنظارتك. هذه الأرقام من حسابك الفعلي.", "A programmable intelligence layer for your glasses. These numbers are read from your account.")}</p>
    {err && <div className="vs-note err" role="alert">{err}</div>}
    <div className="vs-grid" style={{ marginBottom: 22 }}>
      {([[n?.cat, "حواس متاحة", "Available Senses"], [n?.inst, "مثبّتة", "Installed"], [n?.on, "مفعّلة", "Active"]] as const).map(([v, ar, en]) =>
        <div key={en} className="vs-card"><span className="vs-stat">{v ?? "…"}</span><span style={{ color: "var(--mu)" }}>{tr(ar, en)}</span></div>)}
    </div>
    <div className="vs-grid">{steps.map(([href, ar, en, d]) => <Link key={href} href={href} className="vs-card"><h2 style={{ margin: 0 }}>{tr(ar, en)}</h2><p style={{ color: "var(--mu)", lineHeight: 1.6 }}>{d}</p></Link>)}</div>
    <div className="vs-note warn" style={{ marginTop: 22 }}>{tr("ما لم يُبنَ بعد: محرر العقد البصري، محرر الكود، لوحات المعلومات القابلة للتخصيص، المؤسسات.", "Not built yet: visual node editor, code editor, customizable dashboards, organizations.")}</div>
  </>);
}
