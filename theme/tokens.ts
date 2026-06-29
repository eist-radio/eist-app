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
export const type = {
  eyebrow: { fontFamily: font.body, fontWeight: '600', fontSize: 16, letterSpacing: 0.3 } as TextStyle,
  pagehead: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 44, lineHeight: 44, letterSpacing: -0.8 } as TextStyle,
  rowTitle: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 22, lineHeight: 24, letterSpacing: -0.2 } as TextStyle,
  rowSub: { fontFamily: font.body, fontWeight: '500', fontSize: 15 } as TextStyle,
  meta: { fontFamily: font.body, fontWeight: '500', fontSize: 15, letterSpacing: 0.2 } as TextStyle,
  bio: { fontFamily: font.body, fontWeight: '400', fontSize: 16.5, lineHeight: 24 } as TextStyle,
};
