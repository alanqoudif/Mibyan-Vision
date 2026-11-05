import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "مبيان فيجن | Sixth Sense",
  description: "Give your glasses a Sixth Sense. حواس إضافية لنظارتك.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
