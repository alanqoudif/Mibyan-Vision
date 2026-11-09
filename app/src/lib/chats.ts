import { useSyncExternalStore } from 'react';

import { readJSON, writeJSON } from '@/lib/storage';

/** What the assistant did instead of (or before) answering: opened a tool for the user. */
export type ToolUse = { id: string; label: string; icon: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Local file uri of a photo the user attached (or the frame the answer was about). */
  image?: string;
  tool?: ToolUse;
  error?: boolean;
  at: number;
};

export type Chat = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

const FILE = 'chats';
const MAX_CHATS = 60;

let chats: Chat[] = readJSON<Chat[]>(FILE, []);
const listeners = new Set<() => void>();

function commit(next: Chat[], persist = true) {
  chats = next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  if (persist) writeJSON(FILE, chats);
  listeners.forEach((l) => l());
}

export const newId = (p = 'm') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function getChat(id: string | null): Chat | undefined {
  return id ? chats.find((c) => c.id === id) : undefined;
}

/** Creates the chat on its first message, so empty "new chats" never pile up in the list. */
export function appendMessage(chatId: string, input: Omit<ChatMessage, 'at'>, persist = true) {
  const msg: ChatMessage = { ...input, at: Date.now() };
  const existing = chats.find((c) => c.id === chatId);
  if (existing) {
    commit(
      chats.map((c) => (c.id === chatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, msg] } : c)),
      persist,
    );
  } else {
    const title = msg.text.replace(/\s+/g, ' ').trim().slice(0, 48) || '…';
    commit([{ id: chatId, title, updatedAt: Date.now(), messages: [msg] }, ...chats], persist);
  }
}

/** Updates one message in place. Streaming calls this with `persist: false` and saves once at the end. */
export function patchMessage(chatId: string, msgId: string, patch: Partial<ChatMessage>, persist = true) {
  commit(
    chats.map((c) =>
      c.id === chatId ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) } : c,
    ),
    persist,
  );
}

export function deleteChat(id: string) {
  commit(chats.filter((c) => c.id !== id));
}

export function clearChats() {
  commit([]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useChats(): Chat[] {
  return useSyncExternalStore(subscribe, () => chats);
}
