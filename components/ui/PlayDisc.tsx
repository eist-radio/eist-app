// components/ui/PlayDisc.tsx
//
// Filled green coin with a knockout (transparent) glyph punched through it, so
// the artwork / purple ground shows through the play triangle (or stop square).
import React from 'react';
import Svg, { Circle, Defs, Mask, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

export function PlayDisc({
  playing = false,
  size = 72,
  color = colors.green,
}: {
  playing?: boolean;
  size?: number;
  color?: string;
}) {
  const id = React.useId();
  const r = 36;
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <Mask id={id}>
          <Rect width={72} height={72} fill="#fff" />
          {playing ? (
            <Rect x={26} y={26} width={20} height={20} rx={3} fill="#000" />
          ) : (
            <Path d="M29 23 L51 36 L29 49 Z" fill="#000" />
          )}
        </Mask>
      </Defs>
      <Circle cx={36} cy={36} r={r} fill={color} mask={`url(#${id})`} />
    </Svg>
  );
}
