import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Jar } from '@/components/jar';
import { milestones } from '@/lib/encourage';
import { colors } from '@/lib/theme';

// The jar, with the photo of what they are saving for on its front
export function GoalJar({ progress, photo, size = 200 }: { progress: number; photo?: string | null; size?: number }) {
  const badge = size * 0.36;
  return (
    <View style={{ width: size, height: size * 1.1 }}>
      <Jar progress={progress} size={size} />
      {photo && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${photo}` }}
          style={[
            styles.badge,
            { width: badge, height: badge, borderRadius: badge / 2, right: size * 0.02, bottom: size * 0.06 },
          ]}
          contentFit="cover"
          accessibilityLabel="Photo of the goal"
        />
      )}
    </View>
  );
}

/*
 * A coin drops into the jar and the level rises from `from` to `to`.
 * Kept short (under a second and a half) so it delights rather than delays.
 */
export function CoinDrop({ from, to, photo, size = 220, onLanded }: { from: number; to: number; photo?: string | null; size?: number; onLanded?: () => void }) {
  const [fall] = useState(() => new Animated.Value(0));
  const [fill] = useState(() => new Animated.Value(0));
  const [level, setLevel] = useState(from);

  useEffect(() => {
    const id = fill.addListener(({ value }) => setLevel(from + (to - from) * value));
    Animated.sequence([
      Animated.timing(fall, { toValue: 1, duration: 650, easing: Easing.bounce, useNativeDriver: true }),
      Animated.timing(fill, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => onLanded?.());
    return () => fill.removeListener(id);
    // Runs once, when the celebration opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coin = size * 0.2;
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.55, size * 0.32] });
  const opacity = fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <View style={{ width: size, height: size * 1.1, alignItems: 'center' }}>
      <GoalJar progress={level} photo={photo} size={size} />
      <Animated.View
        style={[
          styles.coin,
          { width: coin, height: coin, borderRadius: coin / 2, top: 0, left: size / 2 - coin / 2, opacity, transform: [{ translateY }] },
        ]}
      />
    </View>
  );
}

// One star for each quarter of the goal reached
export function Stars({ count, size = 30 }: { count: number; size?: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${count} of ${milestones.length} stars`}>
      {milestones.map((m, i) => (
        <Svg key={m} width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            fill={i < count ? colors.lime : 'none'}
            stroke={colors.navy}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </Svg>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', borderWidth: 3, borderColor: colors.cream, backgroundColor: colors.blueSoft },
  coin: { position: 'absolute', backgroundColor: colors.lime, borderWidth: 4, borderColor: colors.navy },
  stars: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
});
