import type { PharmacyItem } from '@mibyan/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
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
      setError(cause instanceof Error && cause.message.endsWith('25 MB') ? (dir === 'rtl' ? 'الحد الأقصى لحجم الملف 25 ميغابايت.' : 'Maximum file size is 25 MB.') : t.pharmacyUploadError);
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
  const inputStyle = [styles.input, { backgroundColor: c.card, color: c.text, borderColor: c.border, textAlign: dir === 'rtl' ? 'right' as const : 'left' as const }];
  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30, direction: dir }]} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><CircleButton icon="chevron.backward" label={t.close} onPress={() => router.back()} /><Text variant="heading">{t.pharmacyTitle}</Text><View style={{ width: 48 }} /></View>
    <Text tone="secondary">{t.pharmacyIntro}</Text>{error ? <Text style={{ color: '#b63449' }}>{error}</Text> : null}{notice ? <Text tone="accent">{notice}</Text> : null}
    <View style={[styles.card, { backgroundColor: c.surface }]}><Text variant="title">{t.pharmacyAdd}</Text>
      <TextInput style={inputStyle} placeholder={t.pharmacyName} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <TextInput style={inputStyle} placeholder={t.pharmacyStrength} value={form.strength} onChangeText={(strength) => setForm({ ...form, strength })} />
      <View style={styles.row}><TextInput style={[...inputStyle, { flex: 1 }]} placeholder={t.pharmacyShelf} value={form.shelf} onChangeText={(shelf) => setForm({ ...form, shelf })} /><TextInput style={[...inputStyle, { flex: 1 }]} placeholder={t.pharmacyRow} value={form.row} onChangeText={(row) => setForm({ ...form, row })} /></View>
      <TextInput style={inputStyle} placeholder={t.pharmacyPosition} value={form.position} onChangeText={(position) => setForm({ ...form, position })} />
      <Pressable style={[styles.button, { backgroundColor: c.accent }]} onPress={() => void save()}><Text style={{ color: '#fff', fontWeight: '600' }}>{t.pharmacySave}</Text></Pressable>
    </View>
    <View style={[styles.card, { backgroundColor: c.surface }]}><Text variant="title">{t.pharmacyFiles}</Text><Text variant="caption" tone="secondary">{t.pharmacyUploadHint}</Text>
      <Pressable disabled={busy} style={[styles.button, { backgroundColor: c.card, opacity: busy ? 0.6 : 1 }]} onPress={() => void attachFiles()}><Text>{busy ? (dir === 'rtl' ? 'جارٍ الرفع…' : 'Uploading…') : t.pharmacyAttach}</Text></Pressable>
      {files.map((file) => <View key={file.id} style={styles.row}><Text style={{ flex: 1 }} numberOfLines={1}>{file.file_name}</Text><Pressable onPress={() => void removeFile(file)}><Text style={{ color: '#a23a4c' }}>{t.pharmacyFileRemove}</Text></Pressable></View>)}
    </View>
    <Text variant="heading">{t.pharmacyItems} ({items.length})</Text>{items.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: c.surface }]}><View style={styles.row}><Text variant="heading" style={{ flex: 1 }}>{item.name}{item.strength ? ` · ${item.strength}` : ''}</Text><Pressable onPress={async () => { await supabase?.from('mata_pharmacy_items').delete().eq('id', item.id); await load(); }}><Text style={{ color: '#a23a4c' }}>{t.pharmacyDelete}</Text></Pressable></View><Text variant="caption" tone="secondary">{t.pharmacyShelf} {item.shelf} · {t.pharmacyRow} {item.row}{item.position ? ` · ${item.position}` : ''}</Text></View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: Spacing.three, gap: Spacing.two }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, input: { minHeight: 46, borderWidth: 1, borderRadius: Radius.md, padding: 12 }, button: { minHeight: 48, borderRadius: Radius.md, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' } });
