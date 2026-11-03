import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "مبيان فيجن | إضافات النظارة",
  description: "أنشئ إضافات مبيان فيجن وأدرها واستخدمها مع كاميرا الجوال والنظارة.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
