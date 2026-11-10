"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { useLang, useSession } from "@/lib/vision";
import "@/app/studio/studio.css";

const Ctx = createContext<{ tr: (ar: string, en: string) => string; lang: "ar" | "en"; userId: string }>({ tr: (a) => a, lang: "ar", userId: "" });
export const useStudio = () => useContext(Ctx);

const NAV = [
  ["/studio", "نظرة عامة", "Overview"],
  ["/studio/marketplace", "سوق الحواس", "Marketplace"],
  ["/studio/composer", "مُنشئ الحواس", "Composer"],
  ["/studio/senses", "حواسي", "My Senses"],
  ["/studio/handover", "تسليم الوردية", "Shift Handover"],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang, tr } = useLang();
  const s = useSession();
  const path = usePathname();
  return (
    <div className="vs" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <aside className="vs-side">
        <div className="vs-brand"><span className="vs-ring" aria-hidden /> <span>Sixth Sense</span></div>
        <nav className="vs-nav" aria-label={tr("التنقل", "Navigation")}>
          {NAV.map(([href, ar, en]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{tr(ar, en)}</Link>)}
        </nav>
        <div className="vs-foot">
          {s.email && <span dir="ltr">{s.email}</span>}
          <button className="vs-btn ghost" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{lang === "ar" ? "English" : "العربية"}</button>
          {s.userId && <button className="vs-btn ghost" onClick={() => getSupabase().auth.signOut()}>{tr("تسجيل الخروج", "Sign out")}</button>}
        </div>
      </aside>
      {!s.ready ? <main className="vs-main"><p className="vs-sub">…</p></main>
        : !s.userId ? <SignIn tr={tr} />
        : <Ctx.Provider value={{ tr, lang, userId: s.userId }}><main className="vs-main">{children}</main></Ctx.Provider>}
    </div>
  );
}

function SignIn({ tr }: { tr: (a: string, e: string) => string }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "err" | "good"; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const google = async () => {
    setMsg(null);
    const { error } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/studio` } });
    if (error) setMsg({ kind: "err", text: error.message });
  };
  const go = async (mode: "in" | "up") => {
    setBusy(true); setMsg(null);
    try {
      const sb = getSupabase();
      const r = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
      if (r.error) setMsg({ kind: "err", text: r.error.message });
      else if (mode === "up" && !r.data.session) setMsg({ kind: "good", text: tr("تحقق من بريدك لتأكيد الحساب.", "Check your email to confirm the account.") });
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) }); }
    setBusy(false);
  };
  return (
    <main className="vs-main vs-auth"><form className="vs-card" onSubmit={(e) => { e.preventDefault(); void go("in"); }}>
      <h1 style={{ fontSize: 26 }}>{tr("ادخل إلى Vision Studio", "Sign in to Vision Studio")}</h1>
      <p className="vs-sub" style={{ margin: 0 }}>{tr("نفس الحساب يظهر فيه ما تثبّته على تطبيق الجوال.", "The same account shows what you install in the mobile app.")}</p>
      <label>{tr("البريد", "Email")}<input className="vs-in" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></label>
      <label>{tr("كلمة المرور", "Password")}<input className="vs-in" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label>
      {msg && <div className={`vs-note ${msg.kind}`} role="alert">{msg.text}</div>}
      <button className="vs-btn" type="button" disabled={busy} onClick={() => void google()}>{tr("المتابعة مع Google (حساب مبيان)", "Continue with Google (Mibyan account)")}</button>
      <div className="vs-row"><button className="vs-btn pri" disabled={busy} type="submit">{tr("دخول", "Sign in")}</button><button className="vs-btn" type="button" disabled={busy} onClick={() => void go("up")}>{tr("إنشاء حساب", "Create account")}</button></div>
    </form></main>
  );
}
