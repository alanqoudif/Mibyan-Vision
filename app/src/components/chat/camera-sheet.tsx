import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useChatS } from '@/lib/chat-strings';
import * as Earcons from '@/lib/earcons';
import { useI18n } from '@/lib/i18n';
import { preparePhoto, type Photo } from '@/lib/photo';

/** Full-screen phone camera with one big shutter. Used when the glasses aren't connected. */
export function CameraSheet({ visible, onClose, onPhoto }: { visible: boolean; onClose: () => void; onPhoto: (p: Photo) => void }) {
  const cs = useChatS();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();
  const [perm, request] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const shoot = async () => {
    if (!cam.current || !ready || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.7, shutterSound: false });
      const photo = pic?.uri ? await preparePhoto(pic.uri) : undefined;
      if (photo) {
        Earcons.play('capture');
        onPhoto(photo);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} onShow={() => {
        if (!perm?.granted) void request();
      }}>
      <View style={[styles.root, { direction: dir }]} accessibilityViewIsModal>
        {perm?.granted ? (
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" animateShutter onCameraReady={() => setReady(true)} />
        ) : (
          <View style={styles.denied}>
            <Text variant="heading" center style={{ color: '#fff' }}>
              {cs.cameraDenied}
            </Text>
            <Button label={cs.allowCamera} onPress={() => (perm?.canAskAgain ? request() : Linking.openSettings())} />
          </View>
        )}
        <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]}>
          <CircleButton icon="xmark" label={cs.close} onPress={onClose} />
        </View>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cs.shutter}
            accessibilityState={{ disabled: !ready || busy, busy }}
            disabled={!ready || busy}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, { opacity: !ready ? 0.4 : pressed ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterCore} />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  top: { position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: Spacing.three, flexDirection: 'row' },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, alignItems: 'center' },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});
