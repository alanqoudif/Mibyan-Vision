import Link from "next/link";

export default function Home() {
  return <main className="shell heroPage">
    <nav className="nav"><div className="brand"><span className="brandMark" aria-hidden="true" style={{ backgroundImage: "url('/logo.png')", backgroundSize: "cover", backgroundPosition: "center" }} /><span>مبيان <b>فيجن</b></span></div><Link className="button light" href="/plugins">افتح المنصة <span aria-hidden>←</span></Link></nav>
    <section className="hero">
      <div className="eyebrow"><i /> منصة مبيان فيجن</div>
      <h1>نظارتك، بطريقتك.</h1>
      <p className="lead">أنشئ إضافات تناسب يومك، من الدراسة والتنقل إلى فحص المعدات والبحث عن الأدوية. جرّبها بالكاميرا، ثم استخدمها على الجوال أو النظارة.</p>
      <div className="heroActions"><Link className="button primary" href="/plugins">ابدأ الآن <span aria-hidden>←</span></Link><Link className="textLink" href="/plugins">اكتشف الإضافات الجاهزة</Link></div>
      <div className="heroCards">
        <article className="feature"><span className="featureIcon violet">✦</span><h3>إضافات تناسبك</h3><p>اكتب ما تحتاجه وحدد قدرات الإضافة من خيارات واضحة.</p></article>
        <article className="feature"><span className="featureIcon blue">◉</span><h3>جرّبها مباشرة</h3><p>استخدم كاميرا ومايك جهازك، أو أكمل المحادثة بالكتابة.</p></article>
        <article className="feature"><span className="featureIcon green">⌁</span><h3>تزامن بين أجهزتك</h3><p>إضافاتك الخاصة وكتالوج الصيدلية مرتبطان بحسابك.</p></article>
      </div>
    </section>
    <footer>مبيان فيجن <span>مساعد بصري مرن للجوال والنظارة</span></footer>
  </main>;
}
