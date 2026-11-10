import type { PharmacyItem } from '@mibyan/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, IconAction, PillButton, ScreenHeader } from '@/components/chrome';
import { Divider, Section, rows } from '@/components/settings-rows';
import { Text } from '@/components/text';
import { Spacing, useColors } from '@/constants/theme';
import { useAnnounce } from '@/lib/a11y';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { readJSON, writeJSON } from '@/lib/storage';

type CatalogFile = { id: string; object_path: string; file_name: string; mime_type: string | null; file_size: number; storage: 'local' | 'cloud' };
const blank = { name: '', strength: '', shelf: '', row: '', position: '' };
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LOCAL_FILES = 'pharmacy-catalog-files';
// Made on first use: building the app evaluates this file where there's no file system.
const localDir = () => new Directory(Paths.document, 'pharmacy-catalog');

export default function PharmacyScreen() {
  const router = useRouter(); const c = useColors(); const insets = useSafeAreaInsets(); const { t, dir } = useI18n();
  const [items, setItems] = useState<PharmacyItem[]>([]); const [files, setFiles] = useState<CatalogFile[]>([]); const [form, setForm] = useState(blank); const [userId, setUserId] = useState<string | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useAnnounce(error || notice);
  const load = useCallback(async () => {
    const localFiles = readJSON<CatalogFile[]>(LOCAL_FILES, []).filter((file) => new ExpoFile(file.object_path).exists);
    if (!supabase) { setFiles(localFiles); return; }
    const { data: { user } } = await supabase.auth.getUser(); setUserId(user?.id ?? null);
    if (!user) { setItems([]); setFiles(localFiles); return; }
    const [itemResult, fileResult] = await Promise.all([
      supabase.from('mata_pharmacy_items').select('*').order('name'),
      supabase.from('mata_pharmacy_files').select('id,object_path,file_name,mime_type,file_size').order('created_at', { ascending: false }),
    ]);
    if (itemResult.error) setError(itemResult.error.message); else setItems((itemResult.data ?? []) as PharmacyItem[]);
    if (fileResult.error) { setError(fileResult.error.message); setFiles(localFiles); } else setFiles([...localFiles, ...((fileResult.data ?? []).map((file) => ({ ...file, storage: 'cloud' as const })) as CatalogFile[])]);
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function save() {
    if (!userId || !supabase) { setError(t.pharmacyNeedLogin); return; }
    if (!form.name.trim() || !form.shelf.trim() || !form.row.trim()) { setError(t.pharmacyRequired); return; }
    const { error: saveError } = await supabase.from('mata_pharmacy_items').insert({ ...form, owner_id: userId, strength: form.strength || null, position: form.position || null });
    if (saveError) setError(saveError.message); else { setError(''); setForm(blank); await load(); }
  }
  async function attachFiles() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setBusy(true); setError(''); setNotice('');
    try {
      for (const asset of result.assets) {
        let payload: Blob | Uint8Array;
        if (Platform.OS === 'web') payload = await (await fetch(asset.uri)).blob();
        else payload = await new ExpoFile(asset.uri).bytes();
        const size = asset.size ?? (payload instanceof Uint8Array ? payload.byteLength : payload.size);
        if (size > MAX_FILE_BYTES) throw new Error(`${asset.name}: 25 MB`);
        const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180) || 'catalog-file';
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (supabase && userId) {
          const objectPath = `${userId}/${id}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from('mata-pharmacy-catalog').upload(objectPath, payload, { contentType: asset.mimeType || 'application/octet-stream', upsert: false });
          if (uploadError) throw uploadError;
          const { error: rowError } = await supabase.from('mata_pharmacy_files').insert({ owner_id: userId, object_path: objectPath, file_name: asset.name, mime_type: asset.mimeType || null, file_size: size });
          if (rowError) { await supabase.storage.from('mata-pharmacy-catalog').remove([objectPath]); throw rowError; }
        } else {
          localDir().create({ idempotent: true, intermediates: true });
          const localFile = new ExpoFile(localDir(), `${id}-${safeName}`);
          await new ExpoFile(asset.uri).copy(localFile);
          const current = readJSON<CatalogFile[]>(LOCAL_FILES, []);
          writeJSON(LOCAL_FILES, [...current, { id, object_path: localFile.uri, file_name: asset.name, mime_type: asset.mimeType || null, file_size: size, storage: 'local' }]);
        }
      }
      setError(''); setNotice(supabase && userId ? t.pharmacyUploadDone : t.pharmacyLocalSaved); await load();
    } catch (cause) {
      console.warn('catalog file upload failed', cause);
      setError(cause instanceof Error && cause.message.endsWith('25 MB') ? t.fileTooBig : t.pharmacyUploadError);
    } finally { setBusy(false); }
  }
  async function removeFile(file: CatalogFile) {
    if (file.storage === 'local') {
      const storedFile = new ExpoFile(file.object_path);
      if (storedFile.exists) storedFile.delete();
      writeJSON(LOCAL_FILES, readJSON<CatalogFile[]>(LOCAL_FILES, []).filter((item) => item.id !== file.id));
      await load();
      return;
    }
    if (!supabase) return;
    const { error: removeError } = await supabase.storage.from('mata-pharmacy-catalog').remove([file.object_path]);
    if (removeError) { setError(removeError.message); return; }
    const { error: rowError } = await supabase.from('mata_pharmacy_files').delete().eq('id', file.id);
    if (rowError) setError(rowError.message); else await load();
  }
  const busyLabel = t.uploading;
  return (
    <View style={[styles.root, { backgroundColor: c.surface, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <ScreenHeader title={t.pharmacyTitle} closeLabel={t.close} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} keyboardShouldPersistTaps="handled">
        <Text tone="secondary">{t.pharmacyIntro}</Text>
        {!!error && <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}

        <Section title={t.pharmacyAdd}>
          <View style={rows.pad}>
            <Field label={t.pharmacyName} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
            <Field label={t.pharmacyStrength} value={form.strength} onChangeText={(strength) => setForm({ ...form, strength })} />
            <View style={styles.pair}>
              <Field label={t.pharmacyShelf} containerStyle={styles.half} value={form.shelf} onChangeText={(shelf) => setForm({ ...form, shelf })} />
              <Field label={t.pharmacyRow} containerStyle={styles.half} value={form.row} onChangeText={(row) => setForm({ ...form, row })} />
            </View>
            <Field label={t.pharmacyPosition} value={form.position} onChangeText={(position) => setForm({ ...form, position })} />
            <PillButton label={t.pharmacySave} onPress={() => void save()} />
          </View>
        </Section>

        <Section title={t.pharmacyFiles}>
          <View style={rows.pad}>
            <Text variant="caption" tone="secondary">{t.pharmacyUploadHint}</Text>
            <PillButton icon="paperclip" label={busy ? busyLabel : t.pharmacyAttach} variant="secondary" busy={busy} onPress={() => void attachFiles()} />
          </View>
          {files.map((file) => (
            <Fragment key={file.id}>
              <Divider />
              <View style={rows.row}>
                <SymbolView name="doc" size={22} tintColor={c.textSecondary} />
                <Text style={{ flex: 1 }} numberOfLines={2} ellipsizeMode="middle">{file.file_name}</Text>
                <IconAction icon="trash" label={t.pharmacyRemoveFile(file.file_name)} color={c.stopText} size={20} onPress={() => void removeFile(file)} />
              </View>
            </Fragment>
          ))}
        </Section>

        <Section title={`${t.pharmacyItems} (${items.length})`}>
          {items.length === 0 && (
            <View style={rows.row}>
              <Text tone="secondary">{t.pharmacyEmpty}</Text>
            </View>
          )}
          {items.map((item, i) => {
            const name = `${item.name}${item.strength ? ` · ${item.strength}` : ''}`;
            return (
              <Fragment key={item.id}>
                {i > 0 && <Divider />}
                <View style={rows.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{name}</Text>
                    <Text variant="caption" tone="secondary">
                      {t.pharmacyShelf} <Text variant="caption" tone="secondary" style={styles.num}>{item.shelf}</Text> · {t.pharmacyRow} <Text variant="caption" tone="secondary" style={styles.num}>{item.row}</Text>
                      {item.position ? ` · ${item.position}` : ''}
                    </Text>
                  </View>
                  <IconAction icon="trash" label={t.pharmacyRemoveItem(name)} color={c.stopText} size={20} onPress={async () => { await supabase?.from('mata_pharmacy_items').delete().eq('id', item.id); await load(); }} />
                </View>
              </Fragment>
            );
          })}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
  pair: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1, minWidth: 0 },
  num: { fontVariant: ['tabular-nums'] },
});
