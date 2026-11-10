"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PharmacyItem } from "@mibyan/shared";
import { getSupabase } from "@/lib/supabase";

const empty = { name: "", strength: "", barcode: "", shelf: "", row: "", position: "", notes: "" };
export default function PharmacyPage() {
  const [items, setItems] = useState<PharmacyItem[]>([]);
  const [form, setForm] = useState(empty);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const sb = getSupabase(); const { data: { user } } = await sb.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setItems([]); return; }
      const { data, error } = await sb.from("mata_pharmacy_items").select("*").order("name");
      if (error) throw error; setItems((data ?? []) as PharmacyItem[]);
    } catch (e) { setProblem(e instanceof Error ? e.message : "تعذر تحميل الكتالوج."); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!userId) { setProblem("سجّل الدخول لإدارة كتالوجك."); return; }
    setBusy(true); setProblem("");
    const { error } = await getSupabase().from("mata_pharmacy_items").insert({ ...form, strength: form.strength || null, barcode: form.barcode || null, position: form.position || null, notes: form.notes || null, owner_id: userId });
    if (error) setProblem(error.message); else { setForm(empty); setMessage("تمت إضافة موقع الدواء."); await reload(); }
    setBusy(false);
  }
  async function importCsv(file?: File) {
    if (!file || !userId) return;
    setBusy(true); setProblem("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("حجم ملف CSV يجب أن يكون أقل من 5 ميغابايت.");
      const text = await file.text();
      const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
      const csv = text.replace(/^\uFEFF/, "");
      for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (char === '"' && quoted && csv[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
        else if ((char === "\n" || char === "\r") && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; if (char === "\r" && csv[i + 1] === "\n") i++; }
        else cell += char;
      }
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      const header = rows.shift()?.map((cell) => cell.toLowerCase()) ?? [];
      const index = (names: string[], fallback: number) => { const found = header.findIndex((h) => names.includes(h)); return found < 0 ? fallback : found; };
      const columns = { name: index(["name", "اسم", "الدواء"], 0), strength: index(["strength", "تركيز"], 1), shelf: index(["shelf", "رف", "الرف"], 2), row: index(["row", "صف", "الصف"], 3), position: index(["position", "موقع"], 4), barcode: index(["barcode", "باركود"], 5) };
      const imported = rows.map((cells) => ({ owner_id: userId, name: cells[columns.name] ?? "", strength: cells[columns.strength] || null, shelf: cells[columns.shelf] ?? "", row: cells[columns.row] ?? "", position: cells[columns.position] || null, barcode: cells[columns.barcode] || null })).filter((item) => item.name && item.shelf && item.row).slice(0, 500);
      if (!imported.length) throw new Error("لم نجد صفوفاً مكتملة. يلزم الاسم والرف والصف.");
      const { error } = await getSupabase().from("mata_pharmacy_items").insert(imported);
      if (error) throw error; setMessage(`تم استيراد ${imported.length} دواء.`); await reload();
    } catch (e) { setProblem(e instanceof Error ? e.message : "تعذر استيراد الملف."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) { const { error } = await getSupabase().from("mata_pharmacy_items").delete().eq("id", id); if (error) setProblem(error.message); else await reload(); }
  return <main className="shell workspace"><header className="nav workspaceNav"><Link className="brand" href="/"><span className="brandMark" aria-hidden="true" style={{ backgroundImage: "url('/logo.png')", backgroundSize: "cover", backgroundPosition: "center" }} /><span>مبيان <b>فيجن</b></span></Link><Link href="/plugins" className="button light">العودة للإضافات</Link></header><section className="workspaceHead"><h1>مواقع الأدوية</h1><p>أضف الاسم والتركيز والرف والصف. الإضافة تقرأ موقعاً مسجلاً فقط.</p></section>{problem && <div className="notice error">{problem}</div>}{message && <div className="notice success">{message}</div>}{!userId ? <section className="signInHint"><strong>سجّل الدخول لإدارة الكتالوج</strong><span>البيانات خاصة بحسابك ولا تظهر للحسابات الأخرى.</span><Link className="button primary" href="/plugins">تسجيل الدخول</Link></section> : <div className="workspaceGrid pharmacyGrid"><section className="formPanel"><div className="sectionTitle"><div><h2>أضف دواءً</h2><p>أدخل الموقع كما هو معروف للصيدلي.</p></div><span className="plus">＋</span></div><form className="formStack" onSubmit={save}><label>اسم الدواء<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>التركيز<input value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="اختياري" /></label><div className="twoFields"><label>الرف<input required value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} /></label><label>الصف<input required value={form.row} onChange={(e) => setForm({ ...form, row: e.target.value })} /></label></div><label>الموقع أو خانة إضافية<input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="اختياري" /></label><label>الباركود<input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="اختياري" /></label><label>ملاحظات<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></label><button className="button primary submit" disabled={busy}>حفظ الموقع</button></form><div className="importBox"><strong>استيراد CSV</strong><p>الأعمدة بالترتيب: الاسم، التركيز، الرف، الصف، الموقع، الباركود. يقبل أسماء الأعمدة بالعربية أو الإنجليزية.</p><label className="button light fileButton">اختر ملفاً<input type="file" accept=".csv,text/csv" onChange={(e) => void importCsv(e.target.files?.[0])} /></label><a className="textLink" href="data:text/csv;charset=utf-8,%EF%BB%BFname%2Cstrength%2Cshelf%2Crow%2Cposition%2Cbarcode%0Aباراسيتامول%2C500%20mg%2CA%2C3%2Cيمين%2C" download="mibyan-pharmacy-template.csv">تحميل نموذج CSV</a></div></section><section className="pluginList"><div className="sectionTitle"><div><h2>المخزون المسجل</h2><p>{items.length} دواء في كتالوجك</p></div><span className="count">{items.length}</span></div>{items.length ? items.map((item) => <article className="pluginCard inventoryItem" key={item.id}><div><span className="category category-pharmacy">رف {item.shelf} · صف {item.row}</span></div><h3>{item.name}{item.strength ? ` · ${item.strength}` : ""}</h3><p>{item.position || "لم يحدد موقع إضافي"}{item.barcode ? ` · ${item.barcode}` : ""}</p><button className="textLink dangerText" onClick={() => void remove(item.id)}>حذف</button></article>) : <div className="empty">لا توجد أدوية بعد. أضف موقعاً أو ارفع ملف CSV.</div>}</section></div>}<footer className="workspaceFooter">مبيان فيجن <span>الكتالوج للمساعدة في تحديد الموقع فقط، وليس توصية دوائية.</span></footer></main>;
}
