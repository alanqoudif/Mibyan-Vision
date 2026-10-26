import type { SFSymbol } from 'expo-symbols';

import type { Lang } from '@/lib/i18n';

export type ModeId =
  | 'describe'
  | 'where'
  | 'read'
  | 'find'
  | 'money'
  | 'product'
  | 'meds'
  | 'screen'
  | 'clothes'
  | 'menu'
  | 'people'
  | 'ask'
  | 'live';

export type Mode = {
  id: ModeId;
  title: string;
  /** The suggestion line on the home screen, phrased like something you'd say. */
  prompt: string;
  en: { title: string; prompt: string };
  icon: SFSymbol;
  /** Gradient for the suggestion thumbnail. */
  tint: readonly [string, string];
  /** Coach the user to aim before the photo (needs the whole page / note / label in view). */
  framing?: boolean;
  /** After the answer, the user can ask about the same thing ("what's under 30 riyals?"). */
  followUp?: boolean;
};

export const MODES: Mode[] = [
  {
    id: 'describe',
    title: 'وصف المكان',
    prompt: 'وصف لي المكان اللي قدامي',
    en: { title: 'Describe scene', prompt: 'Describe what’s in front of me' },
    icon: 'eye.fill',
    tint: ['#0064E0', '#00C6FF'],
    followUp: true,
  },
  {
    id: 'where',
    title: 'وين أنا؟',
    prompt: 'وين أنا الحين؟ ووش حولي؟',
    en: { title: 'Where am I?', prompt: 'Where am I, and what’s around me?' },
    icon: 'mappin.and.ellipse',
    tint: ['#1E88E5', '#26C6DA'],
    followUp: true,
  },
  {
    id: 'read',
    title: 'قراءة النص',
    prompt: 'اقرأ لي هالورقة أو الكتاب',
    en: { title: 'Read text', prompt: 'Read this page or book to me' },
    icon: 'text.viewfinder',
    tint: ['#7B61FF', '#C04BFF'],
    framing: true,
    followUp: true,
  },
  {
    id: 'find',
    title: 'ابحث عن شي',
    prompt: 'ساعدني ألقى أغراضي',
    en: { title: 'Find something', prompt: 'Help me find my things' },
    icon: 'magnifyingglass',
    tint: ['#FF7A00', '#FFC400'],
  },
  {
    id: 'money',
    title: 'العملات',
    prompt: 'كم الفلوس اللي بيدي؟',
    en: { title: 'Money', prompt: 'How much money am I holding?' },
    icon: 'banknote.fill',
    tint: ['#00A86B', '#5BE49B'],
    framing: true,
  },
  {
    id: 'product',
    title: 'المنتجات والأدوية',
    prompt: 'وش هالعلبة؟ ومتى تنتهي؟',
    en: { title: 'Products & medicine', prompt: 'What is this box, and when does it expire?' },
    icon: 'pills.fill',
    tint: ['#00897B', '#4DD0C4'],
    framing: true,
    followUp: true,
  },
  {
    id: 'meds',
    title: 'تأكد من الدواء',
    prompt: 'هذا الدواء الصح؟',
    en: { title: 'Check my medicine', prompt: 'Is this the right medicine?' },
    icon: 'checkmark.shield.fill',
    tint: ['#2E7D32', '#81C784'],
    framing: true,
    followUp: true,
  },
  {
    id: 'screen',
    title: 'الشاشات والأجهزة',
    prompt: 'اقرأ لي هالشاشة أو الأزرار',
    en: { title: 'Screens & devices', prompt: 'Read this display or these buttons' },
    icon: 'display',
    tint: ['#3949AB', '#7986CB'],
    framing: true,
    followUp: true,
  },
  {
    id: 'clothes',
    title: 'الألوان والملابس',
    prompt: 'وش لون هالثوب؟ وفيه بقعة؟',
    en: { title: 'Colors & clothes', prompt: 'What color is this, and is it stained?' },
    icon: 'tshirt.fill',
    tint: ['#D81B60', '#F06292'],
    framing: true,
    followUp: true,
  },
  {
    id: 'menu',
    title: 'المنيو والفواتير',
    prompt: 'لخص لي المنيو أو الفاتورة',
    en: { title: 'Menus & bills', prompt: 'Sum up this menu or bill' },
    icon: 'list.bullet.rectangle.portrait.fill',
    tint: ['#F4511E', '#FFB74D'],
    framing: true,
    followUp: true,
  },
  {
    id: 'people',
    title: 'مين حولي',
    prompt: 'وصف لي الناس اللي حولي',
    en: { title: 'People', prompt: 'Describe the people around me' },
    icon: 'person.2.fill',
    tint: ['#E4153B', '#FF6B81'],
    followUp: true,
  },
  {
    id: 'ask',
    title: 'محادثة',
    prompt: 'اسألني أي شي',
    en: { title: 'Conversation', prompt: 'Ask me anything' },
    icon: 'waveform',
    tint: ['#0A1317', '#3A4654'],
  },
  {
    id: 'live',
    title: 'الوضع المباشر',
    prompt: 'راقب معي',
    en: { title: 'Live mode', prompt: 'Watch with me' },
    icon: 'dot.radiowaves.left.and.right',
    tint: ['#0064E0', '#7B61FF'],
  },
];

export function getMode(id: string | undefined): Mode {
  return MODES.find((m) => m.id === id) ?? MODES.find((m) => m.id === 'ask')!;
}

export function modeText(mode: Mode, lang: Lang) {
  return lang === 'en' ? mode.en : { title: mode.title, prompt: mode.prompt };
}
