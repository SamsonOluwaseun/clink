import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { colors } from '@/lib/theme';

// The Samlytics "S": a slanted roadmap inside a blue portrait tile
export function SamlyticsMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size * 0.74} height={size} viewBox="0 0 37 50" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <ClipPath id="tile">
          <Rect x="0" y="0" width="37" height="50" rx="8" />
        </ClipPath>
      </Defs>
      <Rect x="0" y="0" width="37" height="50" rx="8" fill={colors.blue} />
      <Path
        d="M44 -2 L10 18 Q2 23 8 28 Q12 31 18 28 L28 22 Q34 19 37 24 Q40 30 33 33 L-6 56"
        stroke={colors.cream}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        clipPath="url(#tile)"
      />
    </Svg>
  );
}
