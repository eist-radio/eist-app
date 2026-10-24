// components/ui/PlatformDisc.tsx
// Green coin with a SoundCloud/Mixcloud glyph knocked out. Like PlayDisc, but for opening a show externally.
import { faMixcloud, faSoundcloud } from '@fortawesome/free-brands-svg-icons';
import React from 'react';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

export function PlatformDisc({
  platform,
  size = 68,
  color = colors.green,
}: {
  platform: 'soundcloud' | 'mixcloud';
  size?: number;
  color?: string;
}) {
  const id = React.useId();
  const def = platform === 'soundcloud' ? faSoundcloud : faMixcloud;
  const [vbW, vbH, , , rawPath] = def.icon;
  const d = Array.isArray(rawPath) ? rawPath.join(' ') : rawPath;

  // Fit the brand glyph to ~46% of the coin height and centre it in PlayDisc's
  // 72-unit coin space, so both discs share exact proportions at any size.
  const targetH = 72 * 0.46;
  const scale = targetH / vbH;
  const tx = (72 - vbW * scale) / 2;
  const ty = (72 - vbH * scale) / 2;

  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <Mask id={id}>
          <Rect width={72} height={72} fill="#fff" />
          <G transform={`translate(${tx} ${ty}) scale(${scale})`}>
            <Path d={d} fill="#000" />
          </G>
        </Mask>
      </Defs>
      <Circle cx={36} cy={36} r={36} fill={color} mask={`url(#${id})`} />
    </Svg>
  );
}
