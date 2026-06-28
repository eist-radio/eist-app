import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/tokens';

export function Chevron({
  direction = 'right',
  size = 22,
  color = colors.green,
  strokeWidth = 3,
}: {
  direction?: 'left' | 'right';
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const d = direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}
