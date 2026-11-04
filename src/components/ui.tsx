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

import { colors, fonts, radius } from '@/lib/theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'small';

const textStyles: Record<Variant, TextStyle> = {
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.navy },
  heading: { fontFamily: fonts.semibold, fontSize: 20, color: colors.navy },
  body: { fontFamily: fonts.regular, fontSize: 17, color: colors.ink },
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
}: PressableProps & { label: string; kind?: 'primary' | 'gold' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: colors.teal, gold: colors.gold, ghost: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: '#FFFFFF', gold: colors.navy, ghost: colors.tealDark, danger: colors.danger }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: rest.disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 2, borderColor: colors.tealSoft },
        style,
      ]}>
      <RNText style={[styles.buttonText, { color: fg }]}>{label}</RNText>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tint = colors.teal }: { label: string; selected: boolean; onPress: () => void; tint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: tint, borderColor: tint } : null]}>
      <RNText style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{label}</RNText>
    </Pressable>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput placeholderTextColor="#9AA0AE" {...rest} style={styles.input} />
    </View>
  );
}

export function Avatar({ name, colour, size = 52 }: { name: string; colour: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }}>
      <RNText style={{ fontFamily: fonts.bold, color: '#FFFFFF', fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</RNText>
    </View>
  );
}

export function ProgressBar({ value, colour = colors.gold }: { value: number; colour?: string }) {
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
  track: { height: 14, borderRadius: 7, backgroundColor: colors.goldSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 7 },
});
