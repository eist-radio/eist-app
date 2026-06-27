// theme/tokens.ts
import { TextStyle } from 'react-native';

export const colors = {
  purple: '#4733FF',
  green: '#AFFC41',
  lilac: '#B9B0FF',
  pillDim: 'rgba(175,252,65,0.28)',
} as const;

export const font = {
  heading: 'NimbusSans',
  headingBold: 'NimbusSansBold',
  body: 'FunnelSans',
} as const;

export const PAGE_COUNT = 5;
export const space = { screenX: 30, topGap: 6 } as const;

// shared text fragments (colour applied at call site)
export const type = {
  eyebrow: { fontFamily: font.body, fontWeight: '600', fontSize: 13, letterSpacing: 2.6, textTransform: 'uppercase' } as TextStyle,
  pagehead: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 44, lineHeight: 44, letterSpacing: -0.8 } as TextStyle,
  rowTitle: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 22, lineHeight: 24, letterSpacing: -0.2 } as TextStyle,
  rowSub: { fontFamily: font.body, fontWeight: '500', fontSize: 13 } as TextStyle,
  meta: { fontFamily: font.body, fontWeight: '500', fontSize: 12.5, letterSpacing: 1.25, textTransform: 'uppercase' } as TextStyle,
  bio: { fontFamily: font.body, fontWeight: '400', fontSize: 14.5, lineHeight: 22 } as TextStyle,
};
