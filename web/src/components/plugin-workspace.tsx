"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BUILTIN_PLUGINS, PLUGIN_CATEGORIES, validatePluginInput, type PluginDefinition, type PluginCategory, type PluginCapability } from "@mibyan/shared";
import { getSupabase } from "@/lib/supabase";

const categoryName: Record<PluginCategory, string> = { study: "الدراسة", mobility: "التنقل", safety: "السلامة", pharmacy: "الصيدلية", custom: "مخصص" };
const blank = { name: "", description: "", category: "custom" as PluginCategory, instructions: "", capabilities: ["camera", "speech"] as PluginCapability[] };
type SpeechRec = { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };

export function PluginWorkspace() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plugins, setPlugins] = useState<PluginDefinition[]>(BUILTIN_PLUGINS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<"plugins" | "try">("plugins");
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState("builtin-study");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("");
  const [micMessage, setMicMessage] = useState("");

  const sync = useCallback(async () => {
    try {
      const sb = getSupabase();
      const { data: { user: current } } = await sb.auth.getUser();
      setUser(current ? { id: current.id, email: current.email } : null);
      if (current) {
        const { data, error: queryError } = await sb.from("mata_plugins").select("*").eq("owner_id", current.id).order("updated_at", { ascending: false });
        if (queryError) throw queryError;
        setPlugins([...BUILTIN_PLUGINS, ...((data ?? []) as PluginDefinition[])]);
      } else setPlugins(BUILTIN_PLUGINS);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال بالخدمة."); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void sync(), 0);
    try {
      const sb = getSupabase();
      const { data: { subscription } } = sb.auth.onAuthStateChange(() => { setTimeout(() => void sync(), 0); });
      return () => { clearTimeout(timer); subscription.unsubscribe(); };
    } catch { return () => clearTimeout(timer); }
  }, [sync]);

  async function signIn(provider: "google" | "apple") {
    try {
      const sb = getSupabase();
      const { error: authError } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
      if (authError) throw authError;
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل الدخول."); }
  }

  async function savePlugin(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!user) { setError("سجّل الدخول أولاً لحفظ الإضافة على حسابك."); return; }
    const validation = validatePluginInput(form);
    if (validation.length) { setError(validation.join(" ")); return; }
    setBusy(true);
    try {
      const sb = getSupabase();
      const row = { ...form, owner_id: user.id, is_builtin: false };
      const query = editing ? sb.from("mata_plugins").update({ ...row, updated_at: new Date().toISOString() }).eq("id", editing) : sb.from("mata_plugins").insert(row);
      const { error: saveError } = await query;
      if (saveError) throw saveError;
      setNotice(editing ? "تم حفظ التعديلات وتظهر الإضافة في التطبيق عند استخدام الحساب نفسه." : "تم إنشاء الإضافة وهي خاصة بحسابك وتظهر في التطبيق.");
      setForm(blank); setEditing(null); await sync();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الإضافة."); }
    finally { setBusy(false); }
  }

  function editPlugin(plugin: PluginDefinition) {
    setEditing(plugin.id);
    setForm({ name: plugin.name, description: plugin.description, category: plugin.category, instructions: plugin.instructions, capabilities: plugin.capabilities });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removePlugin(id: string) {
    if (!confirm("تحذف هذه الإضافة؟")) return;
    const { error: removeError } = await getSupabase().from("mata_plugins").delete().eq("id", id);
    if (removeError) setError(removeError.message); else { setNotice("تم حذف الإضافة."); await sync(); }
  }

  async function cameraStart() {
    setCameraMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("المتصفح لا يدعم الكاميرا هنا. استخدم اتصالاً آمناً أو اكتب سؤالك.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { setCameraMessage(e instanceof Error ? e.message : "لم تسمح الكاميرا بالعمل. يمكنك المتابعة بالكتابة."); }
  }

  async function runPlugin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setAnswer(""); setError("");
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("إعدادات Supabase غير مكتملة.");
      const plugin = plugins.find((item) => item.id === selected);
      if (!plugin) throw new Error("الإضافة غير موجودة.");
      if (plugin.category === "pharmacy" && !session) throw new Error("سجّل الدخول للوصول إلى كتالوج الصيدلية الخاص بك.");
      let image: string | undefined;
      if (videoRef.current?.srcObject && videoRef.current.videoWidth) {
        const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = Math.round(768 * videoRef.current.videoHeight / videoRef.current.videoWidth);
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        image = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
      }
      const response = await fetch(`${url}/functions/v1/mata-assist`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${session?.access_token ?? key}`, "Content-Type": "application/json" }, body: JSON.stringify({ plugin_id: plugin.id, mode: "ask", text: prompt, image, lang: "ar", device_id: `web-${session?.user.id ?? "guest"}` }) });
      if (!response.ok || !response.body) throw new Error((await response.text()).slice(0, 260) || "تعذر تشغيل الإضافة.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let raw = ""; let buffer = "";
      while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) if (line.startsWith("data: ") && !line.includes("[DONE]")) { try { raw += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? ""; setAnswer(raw.replace(/§[^\n]*\n?/, "").replace(/<[^>]*$/, "")); } catch {} } }
      if (!raw) throw new Error("لم تصل إجابة. جرّب صورة أو سؤالاً أوضح.");
      if ("speechSynthesis" in window) { const speech = new SpeechSynthesisUtterance(raw.replace(/<[^>]*>/g, "").replace(/^§[^\n]*\n?/, "")); speech.lang = "ar"; window.speechSynthesis.speak(speech); }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تشغيل الإضافة."); }
    finally { setBusy(false); }
  }

  function startMic() {
    setMicMessage("");
    const api = window as SpeechWindow;
    const Speech = api.SpeechRecognition ?? api.webkitSpeechRecognition;
    if (!Speech) { setMicMessage("الإملاء الصوتي غير متاح في هذا المتصفح. يمكنك كتابة سؤالك."); return; }
    const recognition = new Speech(); recognition.lang = "ar-OM"; recognition.interimResults = false;
    recognition.onresult = (event) => setPrompt(Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" "));
    recognition.onerror = (event) => setMicMessage(event.error === "not-allowed" ? "لم تسمح باستخدام المايك. يمكنك كتابة سؤالك." : "تعذر التقاط الصوت. جرّب مرة أخرى أو اكتب سؤالك.");
    recognition.onend = () => { if (!micMessage) setMicMessage("انتهى الاستماع."); };
    try { recognition.start(); setMicMessage("أستمع… تحدث الآن."); } catch { setMicMessage("تعذر تشغيل المايك. يمكنك كتابة سؤالك."); }
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  return <main className="shell workspace">
    <header className="nav workspaceNav"><Link className="brand" href="/"><span className="brandMark" aria-hidden="true" style={{ backgroundImage: "url('/logo.png')", backgroundSize: "cover", backgroundPosition: "center" }} /><span>مبيان <b>فيجن</b></span></Link><div className="navActions"><Link href="/plugins" className="navLink">منصتي</Link>{user ? <button className="button light" onClick={async () => { await getSupabase().auth.signOut(); await sync(); }}>تسجيل الخروج</button> : <><button className="button light" onClick={() => void signIn("apple")}>Apple</button><button className="button primary small" onClick={() => void signIn("google")}>Google</button></>}</div></header>
    <section className="workspaceHead"><div className="eyebrow"><i /> مساحة مبيان</div><h1>خلّ النظارة تناسبك.</h1><p>إضافاتك تبقى خاصة بحسابك وتتزامن مع التطبيق.</p></section>
    <div className="tabBar"><button className={tab === "plugins" ? "active" : ""} onClick={() => setTab("plugins")}>الإضافات</button><button className={tab === "try" ? "active" : ""} onClick={() => setTab("try")}>جرّب إضافة</button><Link href="/pharmacy">كتالوج الصيدلية <span>↗</span></Link></div>
    {error && <div className="notice error" role="alert">{error}<button onClick={() => setError("")}>إغلاق</button></div>}{notice && <div className="notice success" role="status">{notice}</div>}
    {!user && <div className="signInHint"><strong>سجّل الدخول للمزامنة</strong><span>تحتاج حساباً لإنشاء الإضافات وحفظ بياناتك.</span><div><button className="button dark" onClick={() => void signIn("apple")}>المتابعة مع Apple</button><button className="button light" onClick={() => void signIn("google")}>المتابعة مع Google</button></div></div>}
    {tab === "plugins" ? <div className="workspaceGrid">
      <section className="pluginList"><div className="sectionTitle"><div><h2>مكتبة الإضافات</h2><p>أربع إضافات جاهزة، وإضافاتك الخاصة.</p></div><span className="count">{plugins.length}</span></div>
        {plugins.map((plugin) => <article className="pluginCard" key={plugin.id}><div className="pluginTop"><span className={`category category-${plugin.category}`}>{categoryName[plugin.category]}</span><span className="privateTag">{plugin.is_builtin ? "جاهزة" : "خاصة"}</span></div><h3>{plugin.name}</h3><p>{plugin.description}</p><div className="pluginActions"><button className="button primary small" onClick={() => { setSelected(plugin.id); setTab("try"); }}>جرّب الإضافة <span>←</span></button>{!plugin.is_builtin && <><button className="button light small" onClick={() => editPlugin(plugin)}>تعديل</button><button className="iconButton" aria-label={`حذف ${plugin.name}`} onClick={() => void removePlugin(plugin.id)}>×</button></>}</div></article>)}
      </section>
      <section className="formPanel"><div className="sectionTitle"><div><h2>{editing ? "عدّل إضافتك" : "أنشئ إضافة"}</h2><p>حدد المهمة والقدرات. لا تحتاج إلى كتابة أي كود.</p></div><span className="plus">＋</span></div>
        <form onSubmit={savePlugin} className="formStack"><label>اسم الإضافة<input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: مساعد مراجعة الدروس" required /></label><label>وصف مختصر<input value={form.description} maxLength={240} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ما الذي تساعد فيه؟" required /></label><label>المجال<select value={form.category} onChange={(e) => { const category = e.target.value as PluginCategory; setForm({ ...form, category, capabilities: category === "pharmacy" ? ["camera", "speech", "catalog"] : ["camera", "speech"] }); }}>{PLUGIN_CATEGORIES.map((category) => <option key={category} value={category}>{categoryName[category]}</option>)}</select></label><label>تعليمات الإضافة<textarea value={form.instructions} maxLength={4000} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="اكتب ما تريد من المساعد أن يلاحظه أو يفعله، ومتى يجب أن يقول إنه غير متأكد." rows={5} required /></label><fieldset><legend>القدرات المسموحة</legend>{(["camera", "speech", ...(form.category === "pharmacy" ? ["catalog"] : []), "location"] as PluginCapability[]).map((cap) => <label className="check" key={cap}><input type="checkbox" checked={form.capabilities.includes(cap)} onChange={(e) => setForm({ ...form, capabilities: e.target.checked ? [...form.capabilities, cap] : form.capabilities.filter((item) => item !== cap) })} />{({ camera: "الكاميرا", speech: "الصوت", catalog: "كتالوج الأدوية", location: "الموقع" } as Record<string,string>)[cap]}</label>)}</fieldset><p className="fieldNote">الإضافة تصف المهمة فقط؛ لا تنفذ تعليمات برمجية، ولا تتجاوز قواعد الأمان.</p><button className="button primary submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إنشاء الإضافة"}</button>{editing && <button type="button" className="textLink" onClick={() => { setEditing(null); setForm(blank); }}>إلغاء التعديل</button>}</form>
      </section>
    </div> : <section className="tryPanel"><div className="sectionTitle"><div><h2>جرّب الإضافة</h2><p>معاينة على كاميرا جهازك ومايكه. لا تحفظ الصورة أو الصوت.</p></div><span className="featureIcon blue">◉</span></div><div className="tryGrid"><div className="cameraBox"><video ref={videoRef} autoPlay playsInline muted /><div className="cameraOverlay"><span>صوّب الكاميرا نحو الشيء الذي تريد فحصه</span></div><button className="button light" onClick={() => void cameraStart()}>تشغيل الكاميرا</button>{cameraMessage && <p role="status">{cameraMessage}</p>}</div><form className="formStack" onSubmit={runPlugin}><label>الإضافة<select value={selected} onChange={(e) => setSelected(e.target.value)}>{plugins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>سؤالك<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="مثال: اشرح لي هذه الفقرة" /></label><div className="tryActions" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><button className="button light" type="button" onClick={startMic}>تحدث بالسؤال 🎙</button><span role="status">{micMessage}</span></div><button className="button primary submit" disabled={busy}>{busy ? "جارٍ التحليل…" : "التقط صورة وأجب"}</button>{answer && <div className="answer" aria-live="polite"><strong>إجابة مبيان</strong><p>{answer}</p><button type="button" className="textLink" onClick={() => { const text = new SpeechSynthesisUtterance(answer); text.lang = "ar"; speechSynthesis.speak(text); }}>استمع إلى الإجابة</button></div>}</form></div></section>}
    <footer className="workspaceFooter">مبيان فيجن <span>يظهر المحتوى بوضوح عندما تكون إعدادات الحساب متصلة.</span></footer>
  </main>;
}
