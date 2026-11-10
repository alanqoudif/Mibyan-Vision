import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FontFamily, MaxFontScale, Radius, SmallTouch, Spacing, useColors } from '@/constants/theme';
import { useChatS } from '@/lib/chat-strings';
import { useI18n } from '@/lib/i18n';
import type { Photo } from '@/lib/photo';

type Props = {
  value: string;
  onChange: (v: string) => void;
  photo: Photo | null;
  onRemovePhoto: () => void;
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
  onPlus: () => void;
  onVoice: () => void;
  /** Live mode: camera and voice together, it watches and talks with you. */
  onLive?: () => void;
};

/** One rounded box: "+" on the start side, the text, then send, or voice mode while it's empty. */
export function Composer({ value, onChange, photo, onRemovePhoto, busy, onSend, onStop, onPlus, onVoice, onLive }: Props) {
  const c = useColors();
  const cs = useChatS();
  const { dir } = useI18n();
  const canSend = !!value.trim() || !!photo;

  return (
    <View style={[styles.box, { backgroundColor: c.card, borderColor: c.border }]}>
      {photo ? (
        <View style={styles.attachRow}>
          <View>
            <Image source={{ uri: photo.uri }} style={styles.attach} contentFit="cover" accessibilityLabel={cs.photo} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cs.removePhoto}
              onPress={onRemovePhoto}
              hitSlop={12}
              style={[styles.remove, { backgroundColor: c.text }]}>
              <SymbolView name="xmark" size={10} tintColor={c.background} weight="bold" />
            </Pressable>
          </View>
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={cs.placeholder}
        placeholderTextColor={c.textTertiary}
        multiline
        maxFontSizeMultiplier={MaxFontScale}
        accessibilityLabel={cs.placeholder}
        style={[styles.input, { color: c.text, fontFamily: FontFamily['400'], textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir }]}
      />
      <View style={styles.bar}>
        <Round icon="plus" label={cs.attach} onPress={onPlus} />
        <View style={{ flex: 1 }} />
        {onLive && !busy && !canSend ? <Round icon="eye" label={cs.live} hint={cs.liveHint} onPress={onLive} /> : null}
        {busy ? (
          <Round icon="stop.fill" label={cs.stop} onPress={onStop} solid />
        ) : canSend ? (
          <Round icon="arrow.up" label={cs.send} onPress={onSend} solid />
        ) : (
          <Round icon="waveform" label={cs.voiceMode} hint={cs.voiceModeHint} onPress={onVoice} solid />
        )}
      </View>
    </View>
  );
}

function Round({ icon, label, hint, onPress, solid }: { icon: SFSymbol; label: string; hint?: string; onPress: () => void; solid?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.round,
        solid ? { backgroundColor: c.accent } : { borderColor: c.border, borderWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name={icon} size={18} tintColor={solid ? c.onAccent : c.text} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  attachRow: { flexDirection: 'row', paddingHorizontal: Spacing.one, paddingBottom: Spacing.two },
  attach: { width: 64, height: 64, borderRadius: Radius.sm },
  remove: { position: 'absolute', top: -6, end: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  input: { fontSize: 17, lineHeight: 24, minHeight: 40, maxHeight: 160, paddingHorizontal: Spacing.two, paddingTop: Spacing.one, paddingBottom: Spacing.one },
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.one },
  round: { width: SmallTouch, height: SmallTouch, borderRadius: SmallTouch / 2, alignItems: 'center', justifyContent: 'center' },
});
