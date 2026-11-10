import { BUILTIN_PLUGINS, validatePluginInput, type PluginCategory, type PluginDefinition, type PluginCapability } from '@mibyan/shared';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton, Field, PillButton, ScreenHeader } from '@/components/chrome';
import { Divider, Section, ToggleRow, rows } from '@/components/settings-rows';
import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { useAnnounce } from '@/lib/a11y';
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
  useAnnounce(error || notice);
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
  const labelFor = (plugin: PluginDefinition) => lang === 'en' ? builtinText[plugin.id]?.en[0] ?? plugin.name : plugin.name;
  const descriptionFor = (plugin: PluginDefinition) => lang === 'en' ? builtinText[plugin.id]?.en[1] ?? plugin.description : plugin.description;
  const tools = MODES.filter((mode) => mode.id !== 'ask');

  return (
    <View style={[styles.root, { backgroundColor: c.surface, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <ScreenHeader
        title={t.manageTools}
        closeLabel={t.close}
        onClose={() => router.back()}
        trailing={<CircleButton icon="person.crop.circle" label={t.pluginAccount} onPress={() => router.push('/account')} />}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} keyboardShouldPersistTaps="handled">
        <Text tone="secondary">{t.pluginIntro}</Text>
        {!!error && <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}

        <Section title={t.toolsAvailable}>
          {tools.map((mode, i) => {
            const value = settings.enabledTools.includes(mode.id);
            return (
              <Fragment key={mode.id}>
                {i > 0 && <Divider />}
                <ToggleRow
                  icon={mode.icon}
                  label={modeText(mode, lang).title}
                  value={value}
                  onChange={(on) => update({ enabledTools: on ? [...new Set([...settings.enabledTools, mode.id])] : settings.enabledTools.filter((id) => id !== mode.id) })}
                />
              </Fragment>
            );
          })}
        </Section>

        <Section title={t.pluginsAvailable}>
          {plugins.map((plugin, i) => {
            const on = active(plugin.id);
            const name = labelFor(plugin);
            return (
              <Fragment key={plugin.id}>
                {i > 0 && <Divider />}
                <View style={rows.pad}>
                  <View style={styles.pluginTop}>
                    <View style={{ flex: 1, gap: Spacing.half }}>
                      <Text variant="heading">{name}</Text>
                      <Text variant="caption" tone="secondary">{plugin.is_builtin ? t.pluginBuiltin : t.pluginPrivate}</Text>
                    </View>
                    <Switch accessibilityLabel={name} value={on} onValueChange={(v) => toggle(plugin.id, v)} trackColor={{ true: c.accent }} />
                  </View>
                  <Text tone="secondary">{descriptionFor(plugin)}</Text>
                  <View style={styles.actions}>
                    <PillButton label={t.pluginUse} accessibilityLabel={`${t.pluginUse} ${name}`} variant="secondary" disabled={!on} onPress={() => launch(plugin)} style={styles.action} />
                    {plugin.category === 'pharmacy' && <PillButton label={t.pharmacyTitle} variant="secondary" onPress={() => router.push('/pharmacy')} style={styles.action} />}
                    {!plugin.is_builtin && (
                      <>
                        <PillButton label={t.pluginEdit} accessibilityLabel={`${t.pluginEdit} ${name}`} variant="secondary" style={styles.action} onPress={() => { setEditing(plugin.id); setForm({ name: plugin.name, description: plugin.description, category: plugin.category, instructions: plugin.instructions, capabilities: plugin.capabilities }); }} />
                        <PillButton label={t.pluginDelete} accessibilityLabel={`${t.pluginDelete} ${name}`} variant="destructive" style={styles.action} onPress={() => void remove(plugin.id)} />
                      </>
                    )}
                  </View>
                </View>
              </Fragment>
            );
          })}
        </Section>

        <Section title={editing ? t.pluginEditTitle : t.pluginCreate}>
          <View style={rows.pad}>
            <Field label={t.pluginName} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
            <Field label={t.pluginDescription} value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
            <View style={{ gap: Spacing.one }}>
              <Text variant="caption" tone="secondary">{t.pluginCategory}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.pluginCategory}>
                {(Object.keys(categoryNames) as PluginCategory[]).map((category) => {
                  const selected = form.category === category;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setForm({ ...form, category, capabilities: category === 'pharmacy' ? ['camera', 'speech', 'catalog'] : ['camera', 'speech'] })}
                      style={[styles.chip, { backgroundColor: selected ? c.text : c.field }]}>
                      <Text variant="caption" style={{ color: selected ? c.background : c.text }}>{categoryNames[category][lang]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Field label={t.pluginInstructions} multiline value={form.instructions} onChangeText={(instructions) => setForm({ ...form, instructions })} />
            <Text variant="caption" tone="secondary">{t.pluginPrivateNote}</Text>
            <PillButton label={editing ? t.pluginEdit : t.pluginCreate} onPress={() => void save()} />
            {editing && <PillButton label={t.cancel} variant="secondary" onPress={() => { setEditing(null); setForm(blank); }} />}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
  pluginTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { minHeight: MinTouch, paddingHorizontal: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: MinTouch, paddingHorizontal: Spacing.three, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
