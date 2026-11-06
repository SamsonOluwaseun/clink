import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Image } from 'expo-image';

import { SamlyticsMark } from '@/components/samlytics-mark';
import { colors, fonts, radius, textOn } from '@/lib/theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'small';

const textStyles: Record<Variant, TextStyle> = {
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.navy },
  heading: { fontFamily: fonts.semibold, fontSize: 20, color: colors.navy },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  small: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[textStyles[variant], style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  kind = 'primary',
  style,
  ...rest
}: PressableProps & { label: string; kind?: 'primary' | 'lime' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: colors.navy, lime: colors.lime, ghost: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: colors.cream, lime: colors.navy, ghost: colors.blueDark, danger: colors.danger }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: rest.disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 2, borderColor: colors.blue },
        style,
      ]}>
      <RNText style={[styles.buttonText, { color: fg }]}>{label}</RNText>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tint = colors.blueDark }: { label: string; selected: boolean; onPress: () => void; tint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: tint, borderColor: tint } : null]}>
      <RNText style={[styles.chipText, selected && { color: textOn(tint) }]}>{label}</RNText>
    </Pressable>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput placeholderTextColor="#9AA0AE" {...rest} style={[styles.input, rest.multiline && { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' }]} />
    </View>
  );
}

export function Avatar({ name, colour, photo, size = 52 }: { name: string; colour: string; photo?: string | null; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (photo) {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${photo}` }}
        style={[shape, { backgroundColor: colour }]}
        contentFit="cover"
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View style={[shape, { backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }]}>
      <RNText style={{ fontFamily: fonts.bold, color: textOn(colour), fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</RNText>
    </View>
  );
}

// Shown at the foot of the main screens
export function PoweredBy() {
  return (
    <View style={styles.powered} accessibilityRole="text" accessibilityLabel="Powered by Samlytics Data Services">
      <SamlyticsMark size={18} />
      <RNText style={styles.poweredText}>
        Powered by <RNText style={{ fontFamily: fonts.bold, color: colors.navy }}>Samlytics Data Services</RNText>
      </RNText>
    </View>
  );
}

export function ProgressBar({ value, colour = colors.blue }: { value: number; colour?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colour }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, gap: 12 },
  button: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.medium, fontSize: 16, color: colors.navy },
  input: {
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.navy,
  },
  track: { height: 14, borderRadius: 7, backgroundColor: colors.blueSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 7 },
  powered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  poweredText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
