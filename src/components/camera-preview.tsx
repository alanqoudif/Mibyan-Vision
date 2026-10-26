import { CameraView } from 'expo-camera';
import { SymbolView } from 'expo-symbols';
import { useEffect, type RefObject } from 'react';
import { Image, StyleSheet } from 'react-native';

import { useCameraSource } from '@/lib/glasses';

type Props = {
  cameraRef: RefObject<CameraView | null>;
  /** Set while the phone camera is mounted and ready to take a picture. */
  readyRef: RefObject<boolean>;
  /** Phone camera permission. */
  granted: boolean;
  iconSize: number;
  iconColor: string;
};

/**
 * The camera tile on capture screens: the latest glasses photo while the glasses are the
 * source, otherwise the phone camera (which only opens then, as the fallback).
 */
export function CameraPreview({ cameraRef, readyRef, granted, iconSize, iconColor }: Props) {
  const source = useCameraSource();

  if (source.glasses) {
    return source.frame ? (
      <Image source={{ uri: source.frame }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
    ) : (
      <SymbolView name="eyeglasses" size={iconSize} tintColor={iconColor} />
    );
  }
  if (!granted) return <SymbolView name="video.slash" size={iconSize} tintColor={iconColor} />;
  return <PhoneCamera cameraRef={cameraRef} readyRef={readyRef} />;
}

function PhoneCamera({ cameraRef, readyRef }: Pick<Props, 'cameraRef' | 'readyRef'>) {
  useEffect(
    () => () => {
      readyRef.current = false;
    },
    [readyRef],
  );
  return (
    <CameraView
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      facing="back"
      animateShutter={false}
      onCameraReady={() => {
        readyRef.current = true;
      }}
    />
  );
}
