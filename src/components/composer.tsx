import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

/** Bottom "Ask anything…" sheet, like Meta AI's composer. */
export function Composer({
  onSubmit,
  onVoice,
  bottomInset,
}: {
  onSubmit: (text: string) => void;
  onVoice: () => void;
  bottomInset: number;
}) {
  const c = useColors();
  const { t, dir } = useI18n();
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow, paddingBottom: bottomInset + Spacing.two },
      ]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t.askPlaceholder}
        placeholderTextColor={c.textTertiary}
        style={[styles.input, { color: c.text, textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir }]}
        returnKeyType="send"
        onSubmitEditing={() => hasText && (onSubmit(text.trim()), setText(''))}
        accessibilityLabel={t.typeQuestion}
        multiline={false}
      />
      <View style={styles.row}>
        <View style={[styles.chip, { backgroundColor: c.surface }]}>
          <SymbolView name="eyeglasses" size={16} tintColor={c.text} />
          <Text variant="caption">{t.glassesCamera}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {hasText ? (
          <CircleButton
            icon="arrow.up"
            label={t.send}
            variant="solid"
            size={44}
            onPress={() => {
              onSubmit(text.trim());
              setText('');
            }}
          />
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.voiceChat}
              accessibilityHint={t.voiceChatHint}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onVoice();
              }}
              style={({ pressed }) => [styles.voice, { backgroundColor: c.text, opacity: pressed ? 0.7 : 1 }]}>
              <SymbolView name="waveform" size={20} tintColor={c.background} weight="semibold" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },
  input: { fontSize: 17, minHeight: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
  },
  voice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
