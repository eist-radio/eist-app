// theme/tokens.ts
import { TextStyle } from 'react-native';

export const colors = {
  purple: '#4733FF',
  green: '#AFFC41',
  text: '#E7E5E5',
  textDim: 'rgba(231,229,229,0.55)',
  pillDim: 'rgba(175,252,65,0.28)',
} as const;

export const font = {
  heading: 'NimbusSans',
  headingBold: 'NimbusSansBold',
  body: 'FunnelSans',
} as const;

export const PAGE_COUNT = 6;
export const space = { screenX: 30, topGap: 6 } as const;

// shared text fragments (colour applied at call site)
//
// Type follows a golden-ratio (φ ≈ 1.618) ladder anchored on the 16px eyebrow:
// 16 (secondary) → 26 (×φ, row/section titles) → 42 (×φ², page & detail heads).
// Everything secondary — eyebrow, rowSub, meta, bio — sits at the 16 tier and is
// differentiated by weight, colour and tracking rather than size, so the three
// sizes read as one clean φ hierarchy across every page.
export const type = {
  eyebrow: { fontFamily: font.body, fontWeight: '600', fontSize: 16, letterSpacing: 0.3 } as TextStyle,
  pagehead: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 42, lineHeight: 43, letterSpacing: -0.8 } as TextStyle,
  rowTitle: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 26, lineHeight: 28, letterSpacing: -0.4 } as TextStyle,
  rowSub: { fontFamily: font.body, fontWeight: '500', fontSize: 16 } as TextStyle,
  meta: { fontFamily: font.body, fontWeight: '500', fontSize: 16, letterSpacing: 0.2 } as TextStyle,
  bio: { fontFamily: font.body, fontWeight: '400', fontSize: 16, lineHeight: 26 } as TextStyle,
};
