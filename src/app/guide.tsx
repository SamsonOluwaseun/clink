import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { GoalJar, Stars } from '@/components/celebration';
import { CoinLogo, Jar } from '@/components/jar';
import { Button, PoweredBy, Text } from '@/components/ui';
import { setSetting } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { guideSteps, type GuideArt } from '@/lib/guide';
import { money } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

// The quick guide: one page per step, swipe or tap Next
export default function Guide() {
  const db = useDb();
  const refresh = useRefresh();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === guideSteps.length - 1;

  const goTo = (i: number) => {
    pager.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const finish = async () => {
    await setSetting(db, 'guide_seen', '1');
    refresh();
    router.back();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) setPage(i);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Text variant="small">
          {page + 1} of {guideSteps.length}
        </Text>
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={12}>
          <Text variant="label" style={{ color: colors.blueDark }}>{last ? 'Close' : 'Skip'}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}>
        {guideSteps.map((s) => (
          <ScrollView key={s.title} style={{ width }} contentContainerStyle={styles.page}>
            <View style={styles.art}>
              <Art kind={s.art} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            {s.body.map((b) => (
              <Text key={b} style={styles.body}>
                {b}
              </Text>
            ))}
            {s.tip && (
              <View style={styles.tip}>
                <Text style={styles.tipText}>{s.tip}</Text>
              </View>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Step ${page + 1} of ${guideSteps.length}`}>
        {guideSteps.map((s, i) => (
          <Pressable key={s.title} accessibilityRole="button" accessibilityLabel={`Go to step ${i + 1}`} onPress={() => goTo(i)} hitSlop={6}>
            <View style={[styles.dot, i === page && styles.dotOn]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        {page > 0 && <Button kind="ghost" label="Back" onPress={() => goTo(page - 1)} style={{ flex: 1 }} />}
        {last ? (
          <Button
            kind="lime"
            label="Add my first child"
            style={{ flex: 2 }}
            onPress={async () => {
              await finish();
              router.push('/child-form');
            }}
          />
        ) : (
          <Button kind="lime" label="Next" onPress={() => goTo(page + 1)} style={{ flex: 2 }} />
        )}
      </View>
      <PoweredBy />
    </SafeAreaView>
  );
}

// A simple picture for each step, from the app's own pieces
function Art({ kind }: { kind: GuideArt }) {
  const cur = money();
  switch (kind) {
    case 'welcome':
      return (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Jar progress={0.55} size={150} />
          <View style={styles.brand}>
            <Text style={styles.wordmark}>clink</Text>
            <CoinLogo size={22} />
          </View>
        </View>
      );
    case 'child':
      return (
        <View style={styles.row}>
          {[colors.blue, colors.lime, colors.navy].map((c, i) => (
            <View key={c} style={[styles.face, { backgroundColor: c }]}>
              <Text style={[styles.faceText, { color: i === 1 ? colors.navy : colors.cream }]}>{['T', 'A', 'B'][i]}</Text>
            </View>
          ))}
        </View>
      );
    case 'goal':
      return (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <GoalJar progress={0.5} size={140} />
          <Stars count={2} />
        </View>
      );
    case 'reward':
      return (
        <View style={{ gap: 10, width: 240 }}>
          <View style={[styles.pill, { backgroundColor: colors.lime }]}>
            <Text style={styles.pillText}>Give a reward</Text>
          </View>
          <View style={styles.row}>
            {cur.quick.slice(1, 4).map((q) => (
              <View key={q} style={[styles.chip, q === cur.quick[2] && { backgroundColor: colors.navy }]}>
                <Text style={[styles.chipText, q === cur.quick[2] && { color: colors.cream }]}>
                  {q < 100 && cur.minor ? `${q}${cur.minor}` : `${cur.symbol}${q / 100}`}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.chip, { backgroundColor: colors.blueDark, alignSelf: 'center' }]}>
            <Text style={[styles.chipText, { color: colors.cream }]}>Great effort!</Text>
          </View>
        </View>
      );
    case 'celebrate':
      return (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Svg width={180} height={110} viewBox="0 0 180 110" accessibilityElementsHidden importantForAccessibility="no">
            <Circle cx="90" cy="30" r="18" fill={colors.lime} stroke={colors.navy} strokeWidth="4" />
            <Path d="M40 30l-14-8M40 46l-16 2M140 30l14-8M140 46l16 2" stroke={colors.blue} strokeWidth="5" strokeLinecap="round" />
            <Rect x="20" y="70" width="10" height="5" rx="2" fill={colors.blue} />
            <Rect x="150" y="66" width="10" height="5" rx="2" fill={colors.limeDeep} />
            <Circle cx="60" cy="90" r="4" fill={colors.navy} />
            <Circle cx="125" cy="92" r="4" fill={colors.blue} />
          </Svg>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Well done, Tobi! Mummy and Daddy are so proud of you!</Text>
          </View>
        </View>
      );
    case 'give':
      return (
        <View style={{ gap: 10, width: 240 }}>
          <View style={[styles.pill, { backgroundColor: colors.navy }]}>
            <Text style={[styles.pillText, { color: colors.cream }]}>Tithe</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.limeSoft }]}>
            <Text style={styles.pillText}>A tenth of what you earn</Text>
          </View>
        </View>
      );
    case 'report':
      return (
        <View style={styles.bars}>
          {[0.3, 0.6, 0.2, 0.9, 0.5, 0.4, 0.7].map((h, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: `${h * 100}%`, backgroundColor: i === 3 ? colors.blue : colors.blueDark }]} />
              <Text style={styles.barDay}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</Text>
            </View>
          ))}
        </View>
      );
    case 'family':
      return (
        <View style={styles.row}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.phone}>
              <Jar progress={0.45} size={56} />
            </View>
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  page: { padding: 24, gap: 14, alignItems: 'center' },
  art: { height: 220, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: 28 },
  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.navy, textAlign: 'center', marginTop: 8 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  tip: { backgroundColor: colors.blueSoft, borderRadius: 18, padding: 14, alignSelf: 'stretch' },
  tipText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.navy, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line },
  dotOn: { width: 24, backgroundColor: colors.navy },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.bold, fontSize: 30, color: colors.navy },
  row: { flexDirection: 'row', gap: 14, justifyContent: 'center', alignItems: 'center' },
  face: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  faceText: { fontFamily: fonts.bold, fontSize: 26 },
  pill: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  pillText: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  chip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.blueSoft },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  bubble: { backgroundColor: colors.blueSoft, borderRadius: 18, padding: 12, maxWidth: 260 },
  bubbleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy, textAlign: 'center' },
  bars: { flexDirection: 'row', gap: 8, height: 140, alignItems: 'flex-end', width: 240 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 6 },
  barDay: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  phone: { width: 84, height: 140, borderRadius: 18, borderWidth: 4, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
});
