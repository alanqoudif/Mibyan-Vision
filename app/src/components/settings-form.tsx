import { View } from 'react-native';

import { Text } from '@/components/text';
import { Chip, TextField, Toggle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import type { SettingField } from '@mibyan/shared/sense';

/** Renders a Sense's declared settings (boolean, text, number, choice). */
export function SettingsForm({ schema, values, onChange }: { schema: SettingField[]; values: Record<string, unknown>; onChange: (key: string, v: unknown) => void }) {
  const { lang } = useI18n();
  return (
    <View style={{ gap: Spacing.three }}>
      {schema.map((f) => {
        const label = lang === 'ar' ? f.label_ar : f.label_en;
        const v = values[f.key] ?? f.default;
        return (
          <View key={f.key} style={{ gap: Spacing.two }}>
            {f.type === 'boolean' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
                <Text variant="heading" style={{ flex: 1 }}>{label}</Text>
                <Toggle value={!!v} onChange={(x) => onChange(f.key, x)} label={label} />
              </View>
            ) : (
              <>
                <Text variant="heading">{label}</Text>
                {f.type === 'enum' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                    {(f.options ?? []).map((o) => (
                      <Chip key={o} label={o} selected={v === o} onPress={() => onChange(f.key, o)} />
                    ))}
                  </View>
                ) : (
                  <TextField
                    value={v === undefined || v === null ? '' : String(v)}
                    placeholder={label}
                    multiline={f.type === 'string'}
                    onChange={(x) => onChange(f.key, f.type === 'number' ? (x === '' ? undefined : Number(x)) : x)}
                  />
                )}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}
