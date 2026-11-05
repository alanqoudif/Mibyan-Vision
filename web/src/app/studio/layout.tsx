import type { Metadata } from "next";
import { Shell } from "@/components/studio/shell";

export const metadata: Metadata = { title: "Vision Studio | Sixth Sense", description: "Install, compose and test Senses for your smart glasses." };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
