import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { InstallSheet } from '@/components/install-sheet';
import { SignInCard } from '@/components/sign-in-card';
import { Text } from '@/components/text';
import { Banner, Card, Chip, EmptyState, ErrorState, IconBadge, LargeTitle, Screen, SearchField, SectionHeader, SenseCard, SkeletonList, useToast } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { CATEGORY_STYLE, DISPLAY_CATEGORIES, EXPERIENCE_SENSES, PACKS, displayCategory, senseDesc, senseName, setEnabled, useCatalog, useInstalledSenses, type DisplayCategory } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import type { SenseManifest } from '@mibyan/shared/sense';

export default function SensesScreen() {
  const router = useRouter();
  const s = useS();
  const { lang } = useI18n();
  const toast = useToast();
  const { settings } = useSettings();
  const glasses = useGlasses();
  const session = useVisionSession();
  const installed = useInstalledSenses();
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DisplayCategory | 'all'>('all');
  const [pack, setPack] = useState<SenseManifest[] | null>(null);

  const match = (m: SenseManifest) =>
    (cat === 'all' || displayCategory(m) === cat) &&
    (!q.trim() || `${senseName(m, lang)} ${senseDesc(m, lang)} ${m.name_en}`.toLowerCase().includes(q.trim().toLowerCase()));

  const ids = useMemo(() => new Set(installed.items.map((i) => i.manifest.id)), [installed.items]);
  const mine = installed.items.filter((i) => match(i.manifest));
  const preferred = EXPERIENCE_SENSES[settings.experience];
  const recommended = catalog.items.filter((m) => !ids.has(m.id) && match(m)).sort((a, b) => Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)));
  const ctx = { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang };
  const byId = (id: string) => catalog.items.find((m) => m.id === id);
  const packTitle = { accessibility: s.packAccessibility, work: s.packWork, everyday: s.packEveryday };
  const showPacks = !q.trim() && cat === 'all';

  return (
    <Screen tabs onRefresh={() => { installed.refresh(); catalog.refresh(); }} refreshing={installed.loading}>
      <LargeTitle>{s.sensesTitle}</LargeTitle>
      <SearchField value={q} onChange={setQ} placeholder={s.searchSenses} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        <Chip label={s.allCategories} selected={cat === 'all'} onPress={() => setCat('all')} />
        {DISPLAY_CATEGORIES.map((k) => (
          <Chip key={k} label={s.cat[k]} icon={CATEGORY_STYLE[k].icon} selected={cat === k} onPress={() => setCat(k)} />
        ))}
      </ScrollView>

      {installed.offline && <Banner message={s.offlineBanner} />}
      {/* Marketplace entry */}
      <Card onPress={() => router.push('/marketplace')} label={`${s.marketplace}. ${s.marketplaceBody}`} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <IconBadge icon="bag.fill" hue="#8B5CF6" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{s.marketplace}</Text>
          <Text variant="caption" tone="secondary">{s.marketplaceBody}</Text>
        </View>
      </Card>

      {/* Installed */}
      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.yourSenses} />
        {!installed.ready ? (
          <SkeletonList />
        ) : installed.error && !installed.items.length ? (
          <ErrorState message={installed.error} onRetry={installed.refresh} />
        ) : mine.length ? (
          mine.map((i) => {
            const k = checkCompat(i.manifest, ctx);
            return (
              <SenseCard
                key={i.manifest.id}
                sense={i.manifest}
                installed
                active={i.enabled}
                compatible={k.runnable}
                onPress={() => router.push(`/sense/${i.manifest.id}`)}
                onToggle={(v) => {
                  if (v && !k.runnable) return toast(s.sdNotRunnable, 'error');
                  setEnabled(i.manifest.id, v).catch((e) => toast(e instanceof Error ? e.message : String(e), 'error'));
                }}
              />
            );
          })
        ) : (
          <EmptyState icon="sparkles" title={installed.items.length ? s.noSensesFound : s.noInstalled} body={installed.items.length ? undefined : s.noInstalledBody} action={{ label: s.marketplace, onPress: () => router.push('/marketplace') }} />
        )}
      </View>

      {installed.ready && !session.email && <SignInCard />}

      {/* Packs */}
      {showPacks && (
        <View style={{ gap: Spacing.two }}>
          <SectionHeader title={s.packs} />
          {PACKS.filter((p) => p.id !== 'everyday').map((p) => {
            const list = p.senses.map(byId).filter((m): m is SenseManifest => !!m);
            if (!list.length) return null;
            const all = list.every((m) => ids.has(m.id));
            return (
              <Card key={p.id} onPress={() => (all ? router.push(`/sense/${list[0].id}`) : setPack(list))} label={`${packTitle[p.id]}. ${s.packBody(list.length)}`} style={{ gap: Spacing.one }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <IconBadge icon={p.id === 'work' ? 'wrench.and.screwdriver.fill' : 'figure.wave'} hue={p.id === 'work' ? '#38D5F0' : '#8B5CF6'} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="heading">{packTitle[p.id]}</Text>
                    <Text variant="caption" tone="secondary">{list.map((m) => senseName(m, lang)).join(' · ')}</Text>
                  </View>
                  <Text variant="caption" tone={all ? 'success' : 'accent'}>{all ? s.installed : s.installPack}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Recommended */}
      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.recommended} action={s.seeAll} onAction={() => router.push('/marketplace')} />
        {recommended.length ? (
          recommended.slice(0, 4).map((m) => (
            <SenseCard
              key={m.id}
              sense={m}
              compatible={checkCompat(m, ctx).deviceOk}
              onPress={() => router.push(`/sense/${m.id}`)}
              onInstall={() => router.push(`/sense/${m.id}?install=1`)}
            />
          ))
        ) : (
          <Text tone="secondary">{s.noSensesFound}</Text>
        )}
      </View>

      <InstallSheet senses={pack ?? []} visible={!!pack} onClose={() => setPack(null)} />
    </Screen>
  );
}
