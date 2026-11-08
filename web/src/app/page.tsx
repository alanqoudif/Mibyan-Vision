"use client";

import Link from "next/link";
import { useState } from "react";
import "./landing.css";

type Lang = "ar" | "en";

const MODS = ["vision", "memory", "inspection", "translation", "productivity", "accessibility", "intelligence", "automation"] as const;
const MOD_POS: Array<[number, number]> = [
  [300, 65], [466, 134], [535, 300], [466, 466], [300, 535], [134, 466], [65, 300], [134, 134],
];

const C = {
  en: {
    dir: "ltr" as "ltr" | "rtl",
    skip: "Skip to content",
    nav: { idea: "The idea", how: "How it works", market: "Senses", dev: "Developers", enterprise: "Enterprise", privacy: "Privacy" },
    studio: "Open Vision Studio",
    langLabel: "Language",
    hero: {
      h1a: "Give Your Glasses",
      h1b: "a Sixth Sense.",
      sub: "Build, customize, and deploy intelligent capabilities that let your smart glasses understand the world your way.",
      phil: "Your World. Your Senses. Your Rules.",
      cta2: "Explore Senses",
      note: "A programmable intelligence layer for smart glasses, designed for Ray-Ban Meta glasses via the Meta Wearables Device Access Toolkit. Early stage: Senses run today on the Mibyan Vision mobile app.",
      art: "Illustration: smart glasses surrounded by rings of Senses.",
      mods: { vision: "Vision", memory: "Memory", inspection: "Inspection", translation: "Translation", productivity: "Productivity", accessibility: "Accessibility", intelligence: "Intelligence", automation: "Automation" },
    },
    idea: {
      k: "The idea",
      h: "Glasses see. A Sense decides what that means for you.",
      p1: "Smart glasses give you a camera, a microphone and speakers on your face. What they do with them is usually fixed by someone else.",
      p2: "A Sense is a small, permissioned capability: it captures what you choose, runs an AI workflow you can read, and hands the result back by voice, in a record, or as a note. Install ready-made Senses, change them, or build your own and combine them.",
      rules: [
        ["Your World", "Senses work on the places, tools and routines you actually have."],
        ["Your Senses", "Pick, build and combine the capabilities you need."],
        ["Your Rules", "Every Sense asks for permissions you can see and refuse."],
      ],
    },
    how: {
      k: "How it works",
      h: "From idea to glasses in four steps",
      steps: [
        ["Discover", "Browse built-in Senses in the marketplace and read exactly what each one can access."],
        ["Customize", "Adjust a Sense, or describe a new one and edit the workflow it produces."],
        ["Deploy", "Install it to your account. It syncs to your phone, ready for your glasses."],
        ["Experience", "Trigger it from the glasses or phone and get the result by voice or in your records."],
      ],
    },
    market: {
      k: "Sense Marketplace",
      h: "Built-in Senses, with their permissions in plain view",
      p: "Four Senses ship as built-ins today. Their manifests and simulated runs are tested; running them on a device is in testing.",
      perms: "Permissions",
      senses: [
        ["Scene Narrator", "Describes what is in front of you in a few clear sentences.", ["Camera", "Spoken output"]],
        ["Read Anything", "Reads signs, labels and documents aloud.", ["Camera", "Spoken output"]],
        ["Equipment Inspection", "Checks equipment against a checklist and files an inspection record.", ["Camera", "Save records", "Memory read", "Notifications"]],
        ["Shift Note", "Turns what you dictate into a note saved to the shift record.", ["Save records", "Spoken output"]],
      ] as Array<[string, string, string[]]>,
      more: "More accessibility Senses are planned.",
      comm: "Community marketplace",
      coming: "Coming",
    },
    create: {
      k: "Create your own Sense",
      h: "Describe what you need. Edit the workflow.",
      lead: "In Vision Studio you write what a Sense should do in plain language. It proposes a workflow of typed nodes that you can read, reorder and limit before anything runs.",
      li: ["Every node declares the permission it needs.", "Runs have step, AI-call and time budgets.", "Actions that matter can require your approval."],
      ill: "Illustration of the idea, not a live result",
      prompt: "“When I scan a pump, check for leaks, save the finding and tell my supervisor if something is wrong.”",
      nodes: [["Capture image", "camera", ""], ["AI vision", "model", "ai"], ["Condition", "if leak", "cond"], ["Save record", "records", ""], ["Notify", "notifications", ""]],
    },
    uses: {
      k: "Real-world uses",
      h: "One layer, many ways to see",
      items: [
        ["Accessibility", "Scene description and reading aloud for people with low vision. One use case among many.", "Scene Narrator and Read Anything built in"],
        ["Industry", "Hands-free equipment inspection with a checklist and a saved record.", "Equipment Inspection built in"],
        ["Productivity", "Dictate shift notes and personal memory without touching a screen.", "Shift Note built in"],
        ["Education", "Read and explain what a learner is looking at.", "Build with the composer"],
        ["Enterprise", "Inspection and shift handover with review and evidence.", "Handover builder in development"],
        ["Developers", "Define Senses as manifests and workflows.", "Open manifest format"],
      ] as Array<[string, string, string]>,
    },
    eco: {
      k: "Connected ecosystem",
      h: "Website, phone and glasses work as one",
      p: "You design in the browser, your phone runs and syncs your Senses, and the glasses are the camera and speaker. Illustrated below.",
      boxes: [
        ["Website", "Vision Studio: marketplace, composer and workflow editor.", "Studio in development"],
        ["Mobile app", "Installs, permissions, records and the bridge to the glasses.", "Senses screen implemented"],
        ["Glasses", "Capture and spoken output, via the phone's connection.", "Designed for Ray-Ban Meta"],
      ],
      link: ["sync", "Bluetooth"],
      cap: "Designed for Ray-Ban Meta glasses via the Meta Wearables Device Access Toolkit. Today the integration targets iOS; without glasses the phone camera is the fallback.",
    },
    dev: {
      k: "Developer platform",
      h: "A Sense is a manifest and a workflow",
      p: "Declare what a Sense is, which permissions it needs and the nodes it runs. The engine validates the graph and refuses to run any node whose permission was not granted.",
      li: ["Typed workflow nodes in a validated graph.", "Permission checks before every run.", "Code sandbox for custom logic: Coming."],
      code: "Example (simplified)",
    },
    ent: {
      k: "Enterprise",
      h: "Inspections and handovers you can audit",
      cards: [
        ["Inspection workflows", "Run a checklist on site, capture photos with consent, and save a structured record.", ["Capture", "Check", "Record", "Review"]],
        ["Shift handover", "Build a handover from the shift's records. A person reviews and approves it, and every statement links back to its source evidence.", ["Records", "Draft", "Human review", "Approved"]],
      ] as Array<[string, string, string[]]>,
      p: "Remote expert assistance: Coming.",
    },
    priv: {
      k: "Privacy & control",
      h: "Built so you stay in charge",
      items: [
        ["Explicit permissions", "Each Sense lists what it needs. You grant it per Sense."],
        ["Consent before recording", "Capture is tied to your action and consent, not to the background."],
        ["You own your data", "Records belong to your account and are protected by per-user access rules."],
        ["No covert monitoring", "No always-on recording and no hidden capture."],
        ["Sources, not guesses", "AI conclusions link to the records they came from."],
      ],
    },
    final: { h: "Start with the Senses you need.", p: "Explore the built-ins, then shape your own.", a: "Explore Senses", b: "Open Vision Studio" },
    foot: { tag: "Mibyan Vision, by Nuqta Technologies, Oman.", legal: "Not affiliated with or endorsed by Meta. Ray-Ban Meta is mentioned only to describe device compatibility.", plugins: "Plugins" },
  },
  ar: {
    dir: "rtl" as "ltr" | "rtl",
    skip: "تخطَّ إلى المحتوى",
    nav: { idea: "الفكرة", how: "كيف يعمل", market: "الحواس", dev: "المطورون", enterprise: "المؤسسات", privacy: "الخصوصية" },
    studio: "افتح Vision Studio",
    langLabel: "اللغة",
    hero: {
      h1a: "امنح نظارتك",
      h1b: "حاسة سادسة.",
      sub: "ابنِ قدرات ذكية وخصّصها وانشرها، لتفهم نظارتك الذكية العالم بطريقتك أنت.",
      phil: "عالمك. حواسك. قواعدك.",
      cta2: "استكشف الحواس",
      note: "طبقة ذكاء قابلة للبرمجة للنظارات الذكية، مصمَّمة لنظارات Ray-Ban Meta عبر Meta Wearables Device Access Toolkit. مرحلة مبكرة: تعمل الحواس اليوم عبر تطبيق مبيان فيجن على الجوال.",
      art: "رسم توضيحي: نظارة ذكية تحيط بها حلقات من الحواس.",
      mods: { vision: "الرؤية", memory: "الذاكرة", inspection: "الفحص", translation: "الترجمة", productivity: "الإنتاجية", accessibility: "إمكانية الوصول", intelligence: "الذكاء", automation: "الأتمتة" },
    },
    idea: {
      k: "الفكرة",
      h: "النظارة ترى. والحاسة تقرر ما معنى ذلك لك.",
      p1: "تمنحك النظارات الذكية كاميرا وميكروفونًا وسماعات على وجهك، لكن ما تفعله بها غالبًا يحدده غيرك.",
      p2: "الحاسة قدرة صغيرة بصلاحيات واضحة: تلتقط ما تختاره، وتشغّل مسار ذكاء اصطناعي تستطيع قراءته، وتعيد النتيجة صوتًا أو سجلًا أو ملاحظة. ثبّت حواسًا جاهزة، أو عدّلها، أو ابنِ حاستك وادمجها مع غيرها.",
      rules: [
        ["عالمك", "تعمل الحواس على أماكنك وأدواتك وروتينك الفعلي."],
        ["حواسك", "اختر القدرات التي تحتاجها وابنِها واجمعها."],
        ["قواعدك", "كل حاسة تطلب صلاحيات تراها وتستطيع رفضها."],
      ],
    },
    how: {
      k: "كيف يعمل",
      h: "من الفكرة إلى النظارة في أربع خطوات",
      steps: [
        ["اكتشف", "تصفّح الحواس الجاهزة في السوق واقرأ بدقة ما تستطيع الوصول إليه."],
        ["خصّص", "عدّل حاسة موجودة، أو صف حاسة جديدة وحرّر المسار الذي تنتجه."],
        ["انشر", "ثبّتها في حسابك. تتزامن مع جوالك وتصبح جاهزة لنظارتك."],
        ["جرّب", "شغّلها من النظارة أو الجوال، واستلم النتيجة صوتًا أو في سجلاتك."],
      ],
    },
    market: {
      k: "سوق الحواس",
      h: "حواس جاهزة، وصلاحياتها أمامك بوضوح",
      p: "تتوفر اليوم أربع حواس جاهزة. ملفاتها وتشغيلاتها المحاكاة مختبرة، وتجربتها على الجهاز قيد الاختبار.",
      perms: "الصلاحيات",
      senses: [
        ["راوي المشهد", "يصف ما أمامك في بضع جمل واضحة.", ["الكاميرا", "الإخراج الصوتي"]],
        ["اقرأ أي شيء", "يقرأ اللوحات والملصقات والمستندات بصوت مسموع.", ["الكاميرا", "الإخراج الصوتي"]],
        ["فحص المعدات", "يفحص المعدة وفق قائمة تحقق ويحفظ سجل فحص.", ["الكاميرا", "حفظ السجلات", "قراءة الذاكرة", "الإشعارات"]],
        ["ملاحظة الوردية", "يحوّل ما تمليه إلى ملاحظة محفوظة في سجل الوردية.", ["حفظ السجلات", "الإخراج الصوتي"]],
      ] as Array<[string, string, string[]]>,
      more: "المزيد من حواس إمكانية الوصول مخطط له.",
      comm: "سوق المجتمع",
      coming: "قريبًا",
    },
    create: {
      k: "ابنِ حاستك",
      h: "صف ما تحتاجه، ثم حرّر المسار.",
      lead: "في Vision Studio تكتب ما يجب أن تفعله الحاسة بلغة عادية، فيقترح مسارًا من عقد محددة النوع تستطيع قراءتها وإعادة ترتيبها وتقييدها قبل أن يعمل أي شيء.",
      li: ["كل عقدة تعلن الصلاحية التي تحتاجها.", "للتشغيل حدود للخطوات واستدعاءات الذكاء والوقت.", "الإجراءات المهمة يمكن أن تتطلب موافقتك."],
      ill: "رسم توضيحي للفكرة وليس نتيجة حية",
      prompt: "«عندما أفحص مضخة، تحقق من التسريب، واحفظ الملاحظة، وأبلغ مشرفي إذا وُجد خلل.»",
      nodes: [["التقاط صورة", "الكاميرا", ""], ["رؤية بالذكاء الاصطناعي", "نموذج", "ai"], ["شرط", "إذا وُجد تسريب", "cond"], ["حفظ سجل", "السجلات", ""], ["إشعار", "الإشعارات", ""]],
    },
    uses: {
      k: "استخدامات واقعية",
      h: "طبقة واحدة، وطرق كثيرة للرؤية",
      items: [
        ["إمكانية الوصول", "وصف المشهد والقراءة بصوت مسموع لضعاف البصر. استخدام واحد من بين عدة استخدامات.", "راوي المشهد واقرأ أي شيء جاهزان"],
        ["الصناعة", "فحص المعدات دون استخدام اليدين، مع قائمة تحقق وسجل محفوظ.", "فحص المعدات جاهز"],
        ["الإنتاجية", "أمل ملاحظات الوردية والذاكرة الشخصية دون لمس الشاشة.", "ملاحظة الوردية جاهزة"],
        ["التعليم", "قراءة وشرح ما ينظر إليه المتعلم.", "ابنه بالمنشئ"],
        ["المؤسسات", "فحص وتسليم ورديات بمراجعة وأدلة.", "منشئ التسليم قيد التطوير"],
        ["المطورون", "عرّف الحواس بملفات تعريف ومسارات.", "صيغة ملف مفتوحة"],
      ] as Array<[string, string, string]>,
    },
    eco: {
      k: "منظومة متصلة",
      h: "الموقع والجوال والنظارة تعمل كوحدة واحدة",
      p: "تصمّم في المتصفح، ويشغّل جوالك حواسك ويزامنها، وتكون النظارة الكاميرا والسماعة. الرسم أدناه توضيحي.",
      boxes: [
        ["الموقع", "Vision Studio: السوق والمنشئ ومحرر المسارات.", "الاستوديو قيد التطوير"],
        ["تطبيق الجوال", "التثبيت والصلاحيات والسجلات والجسر إلى النظارة.", "شاشة الحواس منفذة"],
        ["النظارة", "التقاط وإخراج صوتي عبر اتصال الجوال.", "مصمَّم لـ Ray-Ban Meta"],
      ],
      link: ["مزامنة", "بلوتوث"],
      cap: "مصمَّم لنظارات Ray-Ban Meta عبر Meta Wearables Device Access Toolkit. يستهدف التكامل اليوم نظام iOS، وبدون نظارة تكون كاميرا الجوال هي البديل.",
    },
    dev: {
      k: "منصة المطورين",
      h: "الحاسة ملف تعريف ومسار",
      p: "اعلن ما هي الحاسة، وما الصلاحيات التي تحتاجها، والعقد التي تشغّلها. يتحقق المحرك من الرسم ويرفض تشغيل أي عقدة لم تُمنح صلاحيتها.",
      li: ["عقد مسار محددة النوع في رسم يتم التحقق منه.", "فحص الصلاحيات قبل كل تشغيل.", "بيئة معزولة للشيفرة المخصصة: قريبًا."],
      code: "مثال (مبسّط)",
    },
    ent: {
      k: "المؤسسات",
      h: "فحوصات وتسليمات يمكن تدقيقها",
      cards: [
        ["مسارات الفحص", "نفّذ قائمة تحقق في الموقع، والتقط الصور بموافقة، واحفظ سجلًا منظمًا.", ["التقاط", "فحص", "سجل", "مراجعة"]],
        ["تسليم الورديات", "أنشئ تسليمًا من سجلات الوردية. يراجعه شخص ويعتمده، وكل عبارة ترتبط بدليلها المصدر.", ["سجلات", "مسودة", "مراجعة بشرية", "معتمد"]],
      ] as Array<[string, string, string[]]>,
      p: "مساعدة الخبير عن بُعد: قريبًا.",
    },
    priv: {
      k: "الخصوصية والتحكم",
      h: "مبني لتبقى أنت المتحكم",
      items: [
        ["صلاحيات صريحة", "كل حاسة تعرض ما تحتاجه، وتمنحه أنت لكل حاسة على حدة."],
        ["موافقة قبل التسجيل", "الالتقاط مرتبط بفعلك وموافقتك، وليس بالخلفية."],
        ["بياناتك ملكك", "السجلات تتبع حسابك وتحميها قواعد وصول لكل مستخدم."],
        ["لا مراقبة خفية", "لا تسجيل دائم ولا التقاط مخفي."],
        ["مصادر لا تخمين", "استنتاجات الذكاء الاصطناعي ترتبط بالسجلات التي جاءت منها."],
      ],
    },
    final: { h: "ابدأ بالحواس التي تحتاجها.", p: "استكشف الحواس الجاهزة ثم شكّل حاستك.", a: "استكشف الحواس", b: "افتح Vision Studio" },
    foot: { tag: "مبيان فيجن، من نقطة للتقنية، سلطنة عُمان.", legal: "غير تابع لشركة Meta أو معتمد منها. يُذكر Ray-Ban Meta لوصف توافق الأجهزة فقط.", plugins: "الإضافات" },
  },
};

function Glasses() {
  return (
    <g>
      <path className="glasses-body" d="M290 292 Q300 283 310 292" fill="none" />
      <path className="glasses-body" d="M214 292 L194 284 M386 292 L406 284" fill="none" />
      <rect className="glasses-lens" x="214" y="274" width="76" height="54" rx="24" />
      <rect className="glasses-lens" x="310" y="274" width="76" height="54" rx="24" />
      <path className="glasses-glint" d="M228 294 Q236 284 250 283" />
      <path className="glasses-glint" d="M324 294 Q332 284 346 283" />
    </g>
  );
}

function HeroArt({ t }: { t: typeof C.en }) {
  return (
    <svg viewBox="0 0 600 600" role="img" aria-label={t.hero.art}>
      <circle className="ring" cx="300" cy="300" r="110" />
      <circle className="ring" cx="300" cy="300" r="172" />
      <circle className="ring" cx="300" cy="300" r="235" />
      <circle className="ring-dash r1" cx="300" cy="300" r="110" />
      <circle className="ring-dash r2" cx="300" cy="300" r="172" />
      <circle className="ring-dash r3" cx="300" cy="300" r="235" />
      <circle className="wave" cx="300" cy="300" r="150" />
      <circle className="wave w2" cx="300" cy="300" r="150" />
      <circle className="wave w3" cx="300" cy="300" r="150" />
      <Glasses />
      {MODS.map((m, i) => {
        const [x, y] = MOD_POS[i];
        return (
          <g key={m} className={`mod ${i % 3 === 1 ? "c" : i % 3 === 2 ? "s" : ""}`} transform={`translate(${x} ${y})`}>
            <g>
              <rect x="-58" y="-16" width="116" height="32" rx="16" />
              <circle className="dot" cx={t.dir === "rtl" ? 44 : -44} cy="0" r="4" />
              <text x={t.dir === "rtl" ? -6 : 6} y="4.5">{t.hero.mods[m]}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="#2784d5" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="7.5" fill="none" stroke="#6fb0f0" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2.6" fill="#eeeeee" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 56 24" aria-hidden="true">
      <path d="M2 12 H46 M38 5 L48 12 L38 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MANIFEST = [
  ["c", "// Sense manifest (simplified)"],
  ["", "const sense = {"],
  ["", '  id: "equipment-inspection",'],
  ["", '  name_en: "Equipment Inspection",'],
  ["", "  permissions: ["],
  ["s", '    "camera", "records.write",'],
  ["s", '    "memory.read", "notifications",'],
  ["", "  ],"],
  ["", "  workflow: {"],
  ["", "    nodes: ["],
  ["", '      { id: "t",  type: "trigger" },'],
  ["", '      { id: "cap", type: "capture_image" },'],
  ["", '      { id: "see", type: "ai_vision" },'],
  ["", '      { id: "rec", type: "save_record" },'],
  ["", "    ],"],
  ["", "  },"],
  ["", "};"],
];

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = C[lang];
  const ids = { idea: "idea", how: "how", market: "market", dev: "dev", enterprise: "enterprise", privacy: "privacy" } as const;

  return (
    <div className="lp" lang={lang} dir={t.dir}>
      <a className="skip" href="#main">{t.skip}</a>

      <header className="nav">
        <div className="wrap nav-in">
          <Link className="brand" href="/" aria-label="Mibyan Vision">
            <Logo />
            <span>{lang === "ar" ? "مبيان فيجن" : "Mibyan Vision"}</span>
          </Link>
          <nav className="nav-links" aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main"}>
            {(Object.keys(ids) as Array<keyof typeof ids>).map((k) => (
              <a key={k} href={`#${ids[k]}`}>{t.nav[k]}</a>
            ))}
          </nav>
          <div className="nav-actions">
            <div className="lang" role="group" aria-label={t.langLabel}>
              <button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")} lang="ar">عربي</button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en">EN</button>
            </div>
            <Link className="btn btn-primary btn-sm nav-cta" href="/studio">{t.studio}</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="h-hero">
          <div className="wrap hero-grid">
            <div>
              <h1 id="h-hero" className="rv">
                {t.hero.h1a} <span className="grad">{t.hero.h1b}</span>
              </h1>
              <p className="sub rv d1">{t.hero.sub}</p>
              <p className="philosophy rv d1">{t.hero.phil}</p>
              <div className="cta-row rv d2">
                <Link className="btn btn-primary" href="/studio">{t.studio}</Link>
                <Link className="btn btn-ghost" href="/studio/marketplace">{t.hero.cta2}</Link>
              </div>
              <p className="note rv d3">{t.hero.note}</p>
            </div>
            <div className="hero-art rv d2">
              <HeroArt t={t} />
            </div>
          </div>
        </section>

        <section className="idea" id="idea" aria-labelledby="h-idea">
          <div className="wrap idea-grid">
            <div>
              <h2 id="h-idea">{t.idea.h}</h2>
              <p style={{ marginTop: 20 }}>{t.idea.p1}</p>
              <p>{t.idea.p2}</p>
            </div>
            <ul className="rules">
              {t.idea.rules.map(([a, b]) => (
                <li className="rule" key={a}><b>{a}</b><span>{b}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" aria-labelledby="h-how">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-how">{t.how.h}</h2>
            </div>
            <ol className="steps">
              {t.how.steps.map(([a, b], i) => (
                <li className="step" key={a}>
                  <span className="node" aria-hidden="true">{i + 1}</span>
                  <h3>{a}</h3>
                  <p>{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="market" id="market" aria-labelledby="h-market">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-market">{t.market.h}</h2>
              <p>{t.market.p}</p>
            </div>
            <ul className="cards">
              {t.market.senses.map(([name, desc, perms]) => (
                <li className="card" key={name}>
                  <h3>{name}</h3>
                  <p>{desc}</p>
                  <div>
                    <span className="perms-label">{t.market.perms}</span>
                    <ul className="perms" style={{ marginTop: 8 }}>
                      {perms.map((p) => (<li className="perm" key={p}>{p}</li>))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
            <p className="extra">
              <span>{t.market.more}</span>
              <span>{t.market.comm}</span>
              <span className="tag coming">{t.market.coming}</span>
            </p>
          </div>
        </section>

        <section className="create" aria-labelledby="h-create">
          <div className="wrap create-grid">
            <div>
              <h2 id="h-create">{t.create.h}</h2>
              <p className="lead">{t.create.lead}</p>
              <ul>
                {t.create.li.map((x) => (<li key={x}>{x}</li>))}
              </ul>
            </div>
            <figure className="illus">
              <figcaption className="illus-label">{t.create.ill}</figcaption>
              <p className="prompt">{t.create.prompt}</p>
              <ol className="chain">
                {t.create.nodes.map(([n, s, k]) => (
                  <li className={`cnode ${k}`} key={n}>
                    <i aria-hidden="true" />
                    <span>{n}</span>
                    <small>{s}</small>
                  </li>
                ))}
              </ol>
            </figure>
          </div>
        </section>

        <section className="uses" aria-labelledby="h-uses">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-uses">{t.uses.h}</h2>
            </div>
            <ul className="use-grid">
              {t.uses.items.map(([a, b, c]) => (
                <li className="use" key={a}>
                  <h3>{a}</h3>
                  <p>{b}</p>
                  <span className="tag">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="h-eco">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-eco">{t.eco.h}</h2>
              <p>{t.eco.p}</p>
            </div>
            <div className="eco" role="group" aria-label={t.eco.h}>
              {t.eco.boxes.map(([a, b, c], i) => (
                <div key={a} style={{ display: "contents" }}>
                  <div className="eco-box">
                    <h3>{a}</h3>
                    <p>{b}</p>
                    <span className="tag">{c}</span>
                  </div>
                  {i < 2 && (
                    <div className="eco-link" aria-hidden="true">
                      <Arrow />
                      <span>{i === 0 ? t.eco.link[0] : t.eco.link[1]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="note" style={{ marginTop: 24 }}>{t.eco.cap}</p>
          </div>
        </section>

        <section className="dev" id="dev" aria-labelledby="h-dev">
          <div className="wrap dev-grid">
            <div>
              <h2 id="h-dev">{t.dev.h}</h2>
              <p style={{ color: "var(--muted)", marginTop: 16, fontSize: 18 }}>{t.dev.p}</p>
              <ul>
                {t.dev.li.map((x) => (<li key={x}>{x}</li>))}
              </ul>
            </div>
            <figure>
              <figcaption className="illus-label" style={{ display: "block" }}>{t.dev.code}</figcaption>
              <pre aria-label="TypeScript">
                <code>
                  {MANIFEST.map(([k, line], i) => (
                    <span key={i} className={k}>{line + "\n"}</span>
                  ))}
                </code>
              </pre>
            </figure>
          </div>
        </section>

        <section id="enterprise" aria-labelledby="h-ent">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-ent">{t.ent.h}</h2>
            </div>
            <ul className="ent-grid">
              {t.ent.cards.map(([a, b, flow]) => (
                <li className="ent-card" key={a}>
                  <h3>{a}</h3>
                  <p>{b}</p>
                  <p className="flow" aria-hidden="true">
                    {flow.map((f) => (<span key={f}>{f}</span>))}
                  </p>
                </li>
              ))}
            </ul>
            <p className="extra"><span>{t.ent.p.split(":")[0].split("：")[0]}</span><span className="tag coming">{t.market.coming}</span></p>
          </div>
        </section>

        <section className="privacy" id="privacy" aria-labelledby="h-priv">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="h-priv">{t.priv.h}</h2>
            </div>
            <ul className="priv-grid">
              {t.priv.items.map(([a, b]) => (
                <li className="priv" key={a}>
                  <h3>{a}</h3>
                  <p>{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="final" aria-labelledby="h-final">
          <div className="wrap">
            <svg className="final-art" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="56" fill="none" stroke="#2784d5" strokeWidth="1.5" strokeDasharray="3 8" />
              <circle cx="60" cy="60" r="36" fill="none" stroke="#6fb0f0" strokeWidth="1.5" opacity="0.7" />
              <circle cx="60" cy="60" r="12" fill="#eeeeee" />
            </svg>
            <h2 id="h-final">{t.final.h}</h2>
            <p>{t.final.p}</p>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/studio/marketplace">{t.final.a}</Link>
              <Link className="btn btn-ghost" href="/studio">{t.final.b}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot">
          <div>
            <Link className="brand" href="/"><Logo /><span>{lang === "ar" ? "مبيان فيجن" : "Mibyan Vision"}</span></Link>
            <small>{t.foot.tag}</small>
            <small>{t.foot.legal}</small>
          </div>
          <nav aria-label={lang === "ar" ? "روابط التذييل" : "Footer"}>
            <Link href="/studio">Vision Studio</Link>
            <Link href="/studio/marketplace">{t.nav.market}</Link>
            <Link href="/plugins">{t.foot.plugins}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
