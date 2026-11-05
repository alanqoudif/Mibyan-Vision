"use client";

import type { SenseManifest, Permission } from "@mibyan/shared/sense";

export const PERM: Record<Permission, [string, string]> = {
  camera: ["الكاميرا", "Camera"], microphone: ["الميكروفون", "Microphone"], speech_out: ["النطق بالصوت", "Spoken output"], location: ["الموقع", "Location"],
  notifications: ["الإشعارات", "Notifications"], store_read: ["قراءة السجلات", "Read records"], store_write: ["حفظ السجلات", "Save records"],
  memory_read: ["قراءة الذاكرة", "Read memory"], memory_write: ["الكتابة في الذاكرة", "Write memory"], tasks_write: ["إنشاء مهام", "Create tasks"],
  team_message: ["مراسلة الفريق", "Message team"], network: ["الشبكة", "Network"],
};

export function Perms({ m, lang }: { m: SenseManifest; lang: "ar" | "en" }) {
  return <div className="vs-row">{m.permissions.map((p) => <span key={p} className="vs-chip sand">{PERM[p]?.[lang === "ar" ? 0 : 1] ?? p}</span>)}</div>;
}

export function Chain({ m }: { m: SenseManifest }) {
  return <div className="vs-chain" dir="ltr" aria-label="workflow">{m.workflow.nodes.map((n, i) => (
    <span key={n.id} style={{ display: "contents" }}>{i > 0 && <span className="vs-arrow" aria-hidden>→</span>}<span className="vs-node">{n.kind.split(".").slice(-1)[0]}<small>{n.id}</small></span></span>
  ))}</div>;
}
