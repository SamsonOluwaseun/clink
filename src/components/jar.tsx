import Svg, { Circle, ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { colors } from '@/lib/theme';

const BODY = 'M58 70 Q40 70 40 88 V182 Q40 204 62 204 H138 Q160 204 160 182 V88 Q160 70 142 70 Z';

// A jar that fills with lime as the child gets closer to their goal.
export function Jar({ progress, size = 180 }: { progress: number; size?: number }) {
  // Any money saved shows at least a layer of coins: an empty-looking jar never encourages anyone
  const p = progress > 0 ? Math.max(0.08, Math.min(1, progress)) : 0;
  const top = 70;
  const bottom = 204;
  const level = bottom - (bottom - top) * p;

  // A few coins sitting on the surface of the lime
  const coins = p > 0.04 ? [64, 92, 120, 146].map((x, i) => ({ x, y: level + (i % 2 ? 4 : -2) })) : [];

  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 200 220" accessibilityLabel={`Jar ${Math.round(p * 100)} percent full`}>
      <Defs>
        <ClipPath id="jarBody">
          <Path d={BODY} />
        </ClipPath>
      </Defs>
      <Path d={BODY} fill="#FFFFFF" />
      <Rect x="36" y={level} width="128" height={bottom - level + 4} fill={colors.lime} clipPath="url(#jarBody)" />
      {coins.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r="12" fill={colors.lime} stroke={colors.navy} strokeWidth="3" clipPath="url(#jarBody)" />
      ))}
      <Path d={BODY} fill="none" stroke={colors.navy} strokeWidth="6" />
      <Rect x="54" y="40" width="92" height="24" rx="9" fill={colors.blue} stroke={colors.navy} strokeWidth="5" />
      <Rect x="84" y="48" width="32" height="7" rx="3.5" fill={colors.navy} />
      <Path d="M64 96 Q60 120 62 150" stroke={colors.blueSoft} strokeWidth="7" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function CoinLogo({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx="22" cy="22" r="17" fill={colors.lime} stroke={colors.navy} strokeWidth="4" />
    </Svg>
  );
}
