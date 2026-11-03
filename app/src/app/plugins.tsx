import { BUILTIN_PLUGINS, validatePluginInput, type PluginCategory, type PluginDefinition, type PluginCapability } from '@mibyan/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { MODES, modeText } from '@/lib/modes';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

const blank = { name: '', description: '', category: 'custom' as PluginCategory, instructions: '', capabilities: ['camera', 'speech'] as PluginCapability[] };
const categoryNames: Record<PluginCategory, { ar: string; en: string }> = {
  study: { ar: 'الدراسة', en: 'Study' }, mobility: { ar: 'التنقل', en: 'Mobility' }, safety: { ar: 'السلامة', en: 'Safety' }, pharmacy: { ar: 'الصيدلية', en: 'Pharmacy' }, custom: { ar: 'مخصص', en: 'Custom' },
};
const builtinText: Record<string, { en: [string, string] }> = {
  'builtin-study': { en: ['Study assistant', 'Read and explain content step by step using camera and speech.'] },
  'builtin-navigation': { en: ['Navigation assistant', 'Describe visible landmarks and obstacles.'] },
  'builtin-safety-inspection': { en: ['Safety equipment review', 'Help inspect visible labels and equipment condition.'] },
  'builtin-pharmacy-shelf': { en: ['Pharmacy shelf location', 'Find the saved shelf and row in the pharmacy catalog.'] },
};

export default function PluginsScreen() {
  const router = useRouter(); const c = useColors(); const insets = useSafeAreaInsets(); const { t, lang, dir } = useI18n();
  const { settings, update } = useSettings();
  const [userId, setUserId] = useState<string | null>(null); const [plugins, setPlugins] = useState<PluginDefinition[]>(BUILTIN_PLUGINS);
  const [form, setForm] = useState(blank); const [editing, setEditing] = useState<string | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!supabase) { setUserId(null); setPlugins(BUILTIN_PLUGINS); return; }
    const { data: { user } } = await supabase.auth.getUser(); setUserId(user?.id ?? null);
    if (!user) { setPlugins(BUILTIN_PLUGINS); return; }
    const { data, error: queryError } = await supabase.from('mata_plugins').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false });
    if (queryError) setError(queryError.message); else setPlugins([...BUILTIN_PLUGINS, ...((data ?? []) as PluginDefinition[])]);
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); const sub = supabase?.auth.onAuthStateChange(() => void load()).data.subscription; return () => { clearTimeout(timer); sub?.unsubscribe(); }; }, [load]);
  const active = (id: string) => settings.enabledPluginIds.includes(id);
  const toggle = (id: string, value: boolean) => update({ enabledPluginIds: value ? [...new Set([...settings.enabledPluginIds, id])] : settings.enabledPluginIds.filter((item) => item !== id) });
  const launch = (plugin: PluginDefinition) => {
    if (!active(plugin.id)) return;
    const mode = plugin.category === 'mobility' && plugin.capabilities.includes('location') ? 'where' : 'ask';
    router.push({ pathname: '/session', params: { mode, pluginId: plugin.id } });
  };
  async function save() {
    setError(''); setNotice(''); const issues = validatePluginInput(form);
    if (issues.length) { setError(issues.join(' ')); return; }
    if (!userId || !supabase) { setError(t.pluginSignIn); return; }
    const record = { ...form, owner_id: userId, is_builtin: false };
    const result = editing
      ? await supabase.from('mata_plugins').update({ ...record, updated_at: new Date().toISOString() }).eq('id', editing).select('id').single()
      : await supabase.from('mata_plugins').insert(record).select('id').single();
    if (result.error) setError(result.error.message);
    else { toggle(result.data.id, true); setForm(blank); setEditing(null); setNotice(t.pluginSaved); await load(); }
  }
  async function remove(id: string) { const { error: deleteError } = await supabase!.from('mata_plugins').delete().eq('id', id); if (deleteError) setError(deleteError.message); else { toggle(id, false); await load(); } }
  const inputStyle = [styles.input, { backgroundColor: c.card, color: c.text, borderColor: c.border, textAlign: dir === 'rtl' ? 'right' as const : 'left' as const }];
  const labelFor = (plugin: PluginDefinition) => lang === 'en' ? builtinText[plugin.id]?.en[0] ?? plugin.name : plugin.name;
  const descriptionFor = (plugin: PluginDefinition) => lang === 'en' ? builtinText[plugin.id]?.en[1] ?? plugin.description : plugin.description;

  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30, direction: dir }]} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><CircleButton icon="chevron.backward" label={t.close} onPress={() => router.back()} /><Text variant="heading">{t.manageTools}</Text><Pressable onPress={() => router.push('/account')}><Text tone="accent">{t.pluginAccount}</Text></Pressable></View>
    <Text tone="secondary">{t.pluginIntro}</Text>
    {error ? <Text style={{ color: '#b63449' }}>{error}</Text> : null}{notice ? <Text tone="accent">{notice}</Text> : null}
    <Text variant="title">{t.toolsAvailable}</Text>
    {MODES.filter((mode) => mode.id !== 'ask').map((mode) => {
      const value = settings.enabledTools.includes(mode.id);
      return <View key={mode.id} style={[styles.card, styles.toggleCard, { backgroundColor: c.surface }]}><View style={{ flex: 1 }}><Text variant="heading">{modeText(mode, lang).title}</Text><Text variant="caption" tone="secondary">{value ? t.enabled : t.disabled}</Text></View><Switch value={value} onValueChange={(on) => update({ enabledTools: on ? [...new Set([...settings.enabledTools, mode.id])] : settings.enabledTools.filter((id) => id !== mode.id) })} trackColor={{ true: c.accent }} /></View>;
    })}
    <Text variant="title">{t.pluginsAvailable}</Text>
    {plugins.map((plugin) => <View key={plugin.id} style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.row}><Text variant="heading" style={{ flex: 1 }}>{labelFor(plugin)}</Text><Text variant="caption" tone="secondary">{plugin.is_builtin ? t.pluginBuiltin : t.pluginPrivate}</Text><Switch value={active(plugin.id)} onValueChange={(on) => toggle(plugin.id, on)} trackColor={{ true: c.accent }} /></View>
      <Text variant="caption" tone="secondary">{descriptionFor(plugin)}</Text>
      <View style={styles.row}><Pressable disabled={!active(plugin.id)} style={[styles.button, { backgroundColor: active(plugin.id) ? c.accent : c.border }]} onPress={() => launch(plugin)}><Text style={{ color: '#fff', fontWeight: '600' }}>{t.pluginUse}</Text></Pressable>{plugin.category === 'pharmacy' && <Pressable style={[styles.button, { backgroundColor: c.card }]} onPress={() => router.push('/pharmacy')}><Text>{t.pharmacyTitle}</Text></Pressable>}{!plugin.is_builtin && <><Pressable style={[styles.button, { backgroundColor: c.card }]} onPress={() => { setEditing(plugin.id); setForm({ name: plugin.name, description: plugin.description, category: plugin.category, instructions: plugin.instructions, capabilities: plugin.capabilities }); }}><Text>{t.pluginEdit}</Text></Pressable><Pressable style={[styles.button, { backgroundColor: '#fff0f0' }]} onPress={() => void remove(plugin.id)}><Text style={{ color: '#a23a4c' }}>{t.pluginDelete}</Text></Pressable></>}</View>
    </View>)}
    <View style={[styles.card, { backgroundColor: c.surface }]}><Text variant="title">{editing ? t.pluginEditTitle : t.pluginCreate}</Text>
      <TextInput style={inputStyle} value={form.name} placeholder={t.pluginName} onChangeText={(name) => setForm({ ...form, name })} />
      <TextInput style={inputStyle} value={form.description} placeholder={t.pluginDescription} onChangeText={(description) => setForm({ ...form, description })} />
      <View style={styles.row}>{(Object.keys(categoryNames) as PluginCategory[]).map((category) => <Pressable key={category} style={[styles.chip, { backgroundColor: form.category === category ? c.accent : c.card }]} onPress={() => setForm({ ...form, category, capabilities: category === 'pharmacy' ? ['camera', 'speech', 'catalog'] : ['camera', 'speech'] })}><Text style={{ color: form.category === category ? '#fff' : c.text, fontSize: 12 }}>{categoryNames[category][lang]}</Text></Pressable>)}</View>
      <TextInput style={[...inputStyle, styles.multiline]} multiline value={form.instructions} placeholder={t.pluginInstructions} onChangeText={(instructions) => setForm({ ...form, instructions })} />
      <Text variant="caption" tone="secondary">{t.pluginPrivateNote}</Text>
      <Pressable style={[styles.button, { backgroundColor: c.accent }]} onPress={() => void save()}><Text style={{ color: '#fff', fontWeight: '600' }}>{editing ? t.pluginEdit : t.pluginCreate}</Text></Pressable>
      {editing && <Pressable onPress={() => { setEditing(null); setForm(blank); }}><Text tone="accent">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Text></Pressable>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: Spacing.three, gap: Spacing.two }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }, card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two }, toggleCard: { flexDirection: 'row', alignItems: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap' }, button: { minHeight: 42, borderRadius: Radius.md, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center' }, chip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 999 }, input: { borderWidth: 1, borderRadius: Radius.md, padding: 12, minHeight: 46 }, multiline: { minHeight: 110, textAlignVertical: 'top' } });
