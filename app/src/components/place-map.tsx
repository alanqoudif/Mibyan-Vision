import { requireOptionalNativeModule } from 'expo';
import { SymbolView } from 'expo-symbols';
import { Platform, StyleSheet, View } from 'react-native';

import { useColors, useScheme } from '@/constants/theme';
import type { Coords, NearbyPlace } from '@/lib/nearby';

type MapsModule = typeof import('expo-maps');

/**
 * expo-maps is native: on a build made before it was added, importing it would throw. Only load
 * it when its native module is present; the screen still speaks and lists the results without it.
 */
function loadMaps(): MapsModule | null {
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoMaps')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-maps') as MapsModule;
  } catch {
    return null;
  }
}
const Maps = loadMaps();
export const mapsAvailable = !!Maps;

/** Apple Maps around the user with a pin per result. Decorative for VoiceOver: the list beside it carries the same facts. */
export function PlaceMap({ center, places, icon, selectedId }: { center: Coords; places: NearbyPlace[]; icon?: string; selectedId?: string }) {
  const c = useColors();
  const scheme = useScheme();
  if (!Maps) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: c.surface }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <SymbolView name="map" size={40} tintColor={c.textTertiary} />
      </View>
    );
  }
  const { AppleMaps } = Maps;
  const focus = places.find((p) => p.id === selectedId)?.coords;
  const zoom = places.length ? (places[0].meters > 2500 ? 13 : places[0].meters > 900 ? 14 : 15.5) : 16.5;
  return (
    <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <AppleMaps.View
        // Remount when the focus changes: cameraPosition only sets the initial view.
        key={`${selectedId ?? 'all'}-${places.length}`}
        style={StyleSheet.absoluteFill}
        cameraPosition={{ coordinates: focus ?? center, zoom: focus ? 16.5 : zoom }}
        colorScheme={scheme === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false, scaleBarEnabled: false, togglePitchEnabled: false }}
        markers={places.map((p) => ({
          id: p.id,
          coordinates: p.coords,
          title: p.name || undefined,
          systemImage: icon,
          tintColor: p.id === selectedId || (!selectedId && p === places[0]) ? c.accent : c.textSecondary,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
