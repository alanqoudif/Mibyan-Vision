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
  withTiming,
} from 'react-native-reanimated';

export type SenseOrbState = 'idle' | 'listening' | 'analyzing' | 'responding' | 'connected' | 'disconnected' | 'error';

type Cfg = { a: string; b: string; spin: number; pulse: number; amp: number; glow: number };
const CFG: Record<SenseOrbState, Cfg> = {
  idle: { a: '#7C4DEB', b: '#38D5F0', spin: 16000, pulse: 3400, amp: 0.035, glow: 0.35 },
  connected: { a: '#7C4DEB', b: '#38D5F0', spin: 12000, pulse: 2800, amp: 0.045, glow: 0.45 },
  listening: { a: '#8B5CF6', b: '#A78BFA', spin: 7000, pulse: 900, amp: 0.1, glow: 0.6 },
  analyzing: { a: '#4F46E5', b: '#38D5F0', spin: 1800, pulse: 1300, amp: 0.05, glow: 0.55 },
  responding: { a: '#8B5CF6', b: '#38D5F0', spin: 5000, pulse: 520, amp: 0.13, glow: 0.7 },
  disconnected: { a: '#5B5B72', b: '#8F8EA6', spin: 30000, pulse: 4200, amp: 0.015, glow: 0.12 },
  error: { a: '#FF4D6A', b: '#F5B544', spin: 24000, pulse: 1600, amp: 0.05, glow: 0.4 },
};

/**
 * The Sense Orb: Mibyan's signature mark for active intelligence. Two counter-rotating arcs
 * around a luminous core; its speed, pulse and colour show the state. Decorative only (the
 * state is always also written next to it), and still when Reduce Motion is on.
 * Animates transform/opacity only, so it runs on the UI thread.
 */
export function SenseOrb({ size = 200, state = 'idle' }: { size?: number; state?: SenseOrbState }) {
  const cfg = CFG[state];
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(spin);
    cancelAnimation(pulse);
    if (reduce) {
      spin.value = 0;
      pulse.value = 0.5;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: cfg.spin, easing: Easing.linear }), -1, false);
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: cfg.pulse, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [reduce, cfg.spin, cfg.pulse, spin, pulse]);

  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 1.4}deg` }] }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * cfg.amp }] }));
  const glow = useAnimatedStyle(() => ({
    opacity: cfg.glow * (0.65 + pulse.value * 0.35),
    transform: [{ scale: 1 + pulse.value * cfg.amp * 2.2 }],
  }));

  const box = size * 1.5;
  const ring = size * 0.92;
  const ring2 = size * 0.74;
  const coreSize = size * 0.56;

  return (
    <View
      style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glow]}>
        <LinearGradient
          colors={[cfg.a + '88', cfg.b + '33', 'transparent']}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: size * 1.35, height: size * 1.35, borderRadius: size }}
        />
      </Animated.View>

      <Animated.View style={[styles.abs, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: 2.5, borderColor: cfg.a, borderBottomColor: 'transparent', borderRightColor: cfg.a + '33' }, outer]} />
      <Animated.View style={[styles.abs, { width: ring2, height: ring2, borderRadius: ring2 / 2, borderWidth: 2, borderColor: cfg.b, borderTopColor: 'transparent', borderLeftColor: cfg.b + '33' }, inner]} />

      <Animated.View style={[{ width: coreSize, height: coreSize, borderRadius: coreSize / 2, overflow: 'hidden' }, core]}>
        <LinearGradient colors={[cfg.a, cfg.b]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['#FFFFFF66', 'transparent']} start={{ x: 0.3, y: 0 }} end={{ x: 0.6, y: 0.7 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ abs: { position: 'absolute' } });
