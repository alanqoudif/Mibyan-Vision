export const PLUGIN_CATEGORIES = ["study", "mobility", "safety", "pharmacy", "custom"] as const;
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];
export type PluginCapability = "camera" | "speech" | "catalog" | "location";

export type PluginDefinition = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  category: PluginCategory;
  instructions: string;
  capabilities: PluginCapability[];
  is_builtin: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PharmacyItem = {
  id: string;
  owner_id: string;
  name: string;
  strength: string | null;
  barcode: string | null;
  shelf: string;
  row: string;
  position: string | null;
  notes: string | null;
};

export const BUILTIN_PLUGINS: PluginDefinition[] = [
  {
    id: "builtin-study",
    owner_id: null,
    name: "مساعد الدراسة",
    description: "اقرأ المحتوى واشرحه خطوة بخطوة مع الكاميرا والصوت.",
    category: "study",
    instructions: "ساعد المستخدم على فهم ما يظهر أمام الكاميرا. اقرأ النص عند الطلب، اشرح المفاهيم بلغة واضحة، واسأل سؤالاً توضيحياً عند الحاجة. لا تخترع نصاً غير مقروء.",
    capabilities: ["camera", "speech"],
    is_builtin: true,
  },
  {
    id: "builtin-navigation",
    owner_id: null,
    name: "مساعد التنقل",
    description: "صف المعالم والعوائق الظاهرة حول المستخدم.",
    category: "mobility",
    instructions: "صف ما يظهر بوضوح وباختصار، ونبّه إلى العوائق المرئية فقط. لا تدّع معرفة الطريق الآمن ولا تستبدل وسائل الملاحة أو مساعدة شخص قريب.",
    capabilities: ["camera", "speech", "location"],
    is_builtin: true,
  },
  {
    id: "builtin-safety-inspection",
    owner_id: null,
    name: "مراجعة معدات السلامة",
    description: "ساعد في ملاحظة الملصقات والعلامات المرئية على المعدات.",
    category: "safety",
    instructions: "صف الملصقات والعلامات والحالة الظاهرة للمعدة، واذكر ما لا يمكن التحقق منه بصرياً. لا تصدر شهادة صلاحية أو ضمان سلامة؛ اطلب الرجوع لإجراءات الفحص المعتمدة عند الشك.",
    capabilities: ["camera", "speech"],
    is_builtin: true,
  },
  {
    id: "builtin-pharmacy-shelf",
    owner_id: null,
    name: "موقع الدواء في الصيدلية",
    description: "ابحث في كتالوج الصيدلية عن الرف والصف المسجلين.",
    category: "pharmacy",
    instructions: "طابق اسم الدواء أو تركيزه مع كتالوج المستخدم فقط. اقرأ الموقع المسجل حرفياً. إذا غاب التطابق أو كان ملتبساً فقل ذلك واطلب من الصيدلي التحقق. لا تقدم توصية دوائية أو تشخيصاً.",
    capabilities: ["camera", "speech", "catalog"],
    is_builtin: true,
  },
];

export function validatePluginInput(input: Partial<PluginDefinition>) {
  const errors: string[] = [];
  if (!input.name?.trim() || input.name.trim().length > 60) errors.push("الاسم مطلوب وبحد أقصى 60 حرفاً.");
  if (!input.description?.trim() || input.description.trim().length > 240) errors.push("الوصف مطلوب وبحد أقصى 240 حرفاً.");
  if (!input.instructions?.trim() || input.instructions.trim().length > 4000) errors.push("التعليمات مطلوبة وبحد أقصى 4000 حرف.");
  if (!PLUGIN_CATEGORIES.includes(input.category as PluginCategory)) errors.push("المجال غير صالح.");
  const allowed: PluginCapability[] = ["camera", "speech", "catalog", "location"];
  if (!input.capabilities?.length || input.capabilities.some((cap) => !allowed.includes(cap))) errors.push("اختر قدرة واحدة مسموحة على الأقل.");
  if (input.category !== "pharmacy" && input.capabilities?.includes("catalog")) errors.push("الكتالوج متاح لإضافات الصيدلية فقط.");
  return errors;
}
