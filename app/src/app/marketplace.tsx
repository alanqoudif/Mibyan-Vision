import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/text';
import { Banner, Chip, EmptyState, Screen, ScreenHeader, SearchField, SectionHeader, SenseCard, SkeletonList } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { CATEGORY_STYLE, DISPLAY_CATEGORIES, EXPERIENCE_SENSES, displayCategory, senseDesc, senseName, useCatalog, useInstalledSenses, type DisplayCategory } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import type { SenseManifest } from '@mibyan/shared/sense';

/**
 * A curated catalog of what exists. No popularity, ratings or download counts: the data does not
 * exist yet, so none is shown. "Featured" and "New" are decided only by the catalog's own fields.
 */
export default function MarketplaceScreen() {
  const router = useRouter();
  const s = useS();
  const { lang } = useI18n();
  const { settings } = useSettings();
  const glasses = useGlasses();
  const session = useVisionSession();
  const catalog = useCatalog();
  const installed = useInstalledSenses();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DisplayCategory | 'all'>('all');
  const ids = useMemo(() => new Set(installed.items.map((i) => i.manifest.id)), [installed.items]);
  const ctx = { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang };

  const all = catalog.items.filter(
    (m) =>
      (cat === 'all' || displayCategory(m) === cat) &&
      (!q.trim() || `${senseName(m, lang)} ${senseDesc(m, lang)} ${m.name_en}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const preferred = EXPERIENCE_SENSES[settings.experience];
  const featured = all.filter((m) => m.kind === 'builtin');
  const forYou = all.filter((m) => preferred.includes(m.id) && !ids.has(m.id));
  const newest = [...all].sort((a, b) => b.version.localeCompare(a.version)).slice(0, 4);
  const sections: { key: string; title: string; items: SenseManifest[] }[] = [
    { key: 'featured', title: s.mkFeatured, items: featured },
    { key: 'rec', title: s.mkRecommended, items: forYou },
    ...DISPLAY_CATEGORIES.map((k) => ({ key: k, title: s.cat[k], items: all.filter((m) => displayCategory(m) === k) })),
    { key: 'new', title: s.mkNew, items: newest },
  ].filter((x) => x.items.length > 0);

  const card = (m: SenseManifest) => {
    const on = ids.has(m.id);
    return (
      <SenseCard
        key={m.id}
        sense={m}
        installed={on}
        active={installed.items.find((i) => i.manifest.id === m.id)?.enabled}
        compatible={checkCompat(m, ctx).deviceOk}
        onPress={() => router.push(`/sense/${m.id}`)}
        onInstall={on ? undefined : () => router.push(`/sense/${m.id}?install=1`)}
      />
    );
  };

  return (
    <Screen header={<ScreenHeader back title={s.marketplace} />}>
      <SearchField value={q} onChange={setQ} placeholder={s.searchSenses} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        <Chip label={s.allCategories} selected={cat === 'all'} onPress={() => setCat('all')} />
        {DISPLAY_CATEGORIES.map((k) => (
          <Chip key={k} label={s.cat[k]} icon={CATEGORY_STYLE[k].icon} selected={cat === k} onPress={() => setCat(k)} />
        ))}
      </ScrollView>
      <Banner tone="accent" icon="info.circle.fill" message={`${catalog.source === 'account' ? s.mkCatalogSource : s.mkCatalogLocal}. ${s.mkNoMetrics}`} />
      {catalog.loading && !catalog.items.length ? <SkeletonList count={4} /> : null}
      {sections.length === 0 ? (
        <EmptyState icon="magnifyingglass" title={s.noSensesFound} />
      ) : (
        sections.map((sec) => (
          <View key={sec.key} style={{ gap: Spacing.two }}>
            <SectionHeader title={sec.title} />
            {sec.items.map(card)}
          </View>
        ))
      )}
      <Text variant="label" tone="tertiary" center>{s.tagline2}</Text>
    </Screen>
  );
}
