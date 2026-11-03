import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { OrbColors, useColors } from '@/constants/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const BREATH: Record<OrbState, number> = { idle: 2400, listening: 700, thinking: 1100, speaking: 420 };
const SPIN: Record<OrbState, number> = { idle: 9000, listening: 5000, thinking: 1600, speaking: 4000 };
const AMP: Record<OrbState, number> = { idle: 0.03, listening: 0.08, thinking: 0.05, speaking: 0.14 };
/** With Reduce Motion on, the orb holds still and shows its state by how open the ring is. */
const STILL_HOLE: Record<OrbState, number> = { idle: 1, listening: 0.92, thinking: 0.96, speaking: 0.84 };

/**
 * The live-agent orb: a rotating gradient ring with a soft glow, Mibyan's "working" signal.
 * The hole "breathes" and the ring wobbles so it feels alive. Decorative only: every state it
 * shows is also spoken, sounded (earcons) or written next to it. Honors Reduce Motion.
 */
export function Orb({ size = 160, state = 'idle' }: { size?: number; state?: OrbState }) {
  const c = useColors();
  const spin = useSharedValue(0);
  const breath = useSharedValue(0);
  const wobble = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(spin);
      cancelAnimation(breath);
      cancelAnimation(wobble);
      spin.value = 0;
      breath.value = 0;
      wobble.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: SPIN[state], easing: Easing.linear }), -1, false);
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH[state], easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATH[state] * 1.3, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: BREATH[state] * 1.3, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breath);
      cancelAnimation(wobble);
    };
  }, [state, spin, breath, wobble, reduceMotion]);

  const amp = AMP[state];

  const body = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 1 + breath.value * amp + wobble.value * amp * 0.5 },
      { scaleY: 1 + breath.value * amp - wobble.value * amp * 0.5 },
    ],
  }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const still = reduceMotion ? STILL_HOLE[state] : 0;
  const glow = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.4,
    transform: [{ scale: 1.05 + breath.value * amp * 2 }],
  }));
  const hole = useAnimatedStyle(() => ({
    transform: [
      {
        scale: still
          ? still
          : state === 'speaking'
            ? 0.92 - breath.value * 0.14
            : 1 - breath.value * 0.05,
      },
    ],
  }));

  const r = size / 2;
  const holeSize = size * 0.66;

  return (
    <View
      style={{ width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* soft glow */}
      <Animated.View style={[styles.abs, glow]}>
        <LinearGradient
          colors={['rgba(0,100,224,0.35)', 'rgba(123,97,255,0.25)', 'rgba(0,198,255,0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size * 1.25, height: size * 1.25, borderRadius: size }}
        />
      </Animated.View>

      <Animated.View
        style={[
          { width: size, height: size, borderRadius: r, backgroundColor: c.background },
          styles.shadow,
          { shadowColor: '#2F6BFF' },
          body,
        ]}>
        <View style={{ flex: 1, borderRadius: r, overflow: 'hidden' }}>
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          <LinearGradient
            colors={OrbColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,198,255,0.9)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View
            style={[
              { width: holeSize, height: holeSize, borderRadius: holeSize / 2, backgroundColor: c.background },
              hole,
            ]}
          />
        </View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Tiny static orb used as an icon (tab-like buttons, chips). */
export function OrbMark({ size = 22 }: { size?: number }) {
  const c = useColors();
  return (
    <LinearGradient
      colors={OrbColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{ width: size * 0.6, height: size * 0.6, borderRadius: size, backgroundColor: c.background }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  shadow: { shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 8 } },
});
