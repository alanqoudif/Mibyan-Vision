import type { Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';

import type { Lang } from '@/lib/i18n';
import type { Shortcut } from '@/lib/settings';
import { MODES, modeText, type ModeId } from '@/lib/modes';

/**
 * Everything the assistant can do besides talk, in one list. The chat picks one of these from
 * what the user typed; the side menu and the "+" sheet list them for people who'd rather tap.
 */
export type Capability = {
  id: string;
  icon: SFSymbol;
  label: string;
  /** One line under the label in the "+" sheet. */
  hint: string;
  href: (q?: string) => Href;
  /** Needs this tool switched on in the assistant settings. */
  tool?: ModeId;
};

const SHEET_MODES: ModeId[] = ['describe', 'read', 'money', 'product', 'meds', 'screen', 'clothes', 'menu', 'people', 'where'];

export function capabilities(lang: Lang, enabled: ModeId[]): Capability[] {
  const ar = lang === 'ar';
  const extra: Capability[] = [
    {
      id: 'live',
      icon: 'dot.radiowaves.left.and.right',
      label: ar ? 'راقب معي' : 'Watch with me',
      hint: ar ? 'يوصف لك اللي حولك وأنت تمشي' : 'Narrates around you as you move',
      href: () => '/live',
      tool: 'live',
    },
    {
      id: 'find',
      icon: 'magnifyingglass',
      label: ar ? 'دوّر على شي' : 'Find something',
      hint: ar ? 'يوجهك لين توصل لغرضك' : 'Guides you to an object',
      href: (q) => (q ? { pathname: '/find', params: { q } } : '/find'),
      tool: 'find',
    },
    {
      id: 'qibla',
      icon: 'location.north.circle',
      label: ar ? 'القبلة' : 'Qibla',
      hint: ar ? 'اتجاه القبلة بالصوت والاهتزاز' : 'Qibla direction by sound and touch',
      href: () => '/qibla',
      tool: 'where',
    },
    {
      id: 'helper',
      icon: 'person.2.wave.2.fill',
      label: ar ? 'اتصل بمساعد' : 'Call a helper',
      hint: ar ? 'شخص تثق فيه يشوف معك' : 'Someone you trust sees with you',
      href: () => '/helper',
    },
  ];
  const modes: Capability[] = SHEET_MODES.map((id) => {
    const m = MODES.find((x) => x.id === id)!;
    const txt = modeText(m, lang);
    return {
      id,
      icon: m.icon,
      label: txt.title,
      hint: txt.prompt,
      href: (q?: string) => ({ pathname: '/session', params: q ? { mode: id, q } : { mode: id } }),
      tool: id,
    };
  });
  return [...extra, ...modes].filter((c) => !c.tool || enabled.includes(c.tool));
}

export function capabilityFor(id: string, lang: Lang, enabled: ModeId[]) {
  return capabilities(lang, enabled).find((c) => c.id === id);
}

export type ResolvedShortcut = { shortcut: Shortcut; label: string; icon: SFSymbol; cap?: Capability };

/** What a saved shortcut shows and does now. Tools that were switched off drop out. */
export function resolveShortcuts(list: Shortcut[], lang: Lang, enabled: ModeId[]): ResolvedShortcut[] {
  const caps = capabilities(lang, enabled);
  return list.flatMap((sc): ResolvedShortcut[] => {
    if (sc.kind === 'prompt') return sc.text?.trim() ? [{ shortcut: sc, label: sc.label || sc.text, icon: 'text.bubble' }] : [];
    const cap = caps.find((c) => c.id === sc.tool);
    return cap ? [{ shortcut: sc, label: sc.label || cap.label, icon: cap.icon, cap }] : [];
  });
}
