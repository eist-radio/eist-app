import React from 'react';
import { ScrollView, Pressable, Text, Linking } from 'react-native';
import { colors, font, type } from '../../theme/tokens';
import { PageScaffold } from '../ui/PageScaffold';
import { Eyebrow } from '../ui/Eyebrow';

const LINKS = [
  { label: 'Discord', url: 'https://discord.gg/4eHnAAUmFN' },
  { label: 'Instagram', url: 'https://www.instagram.com/eistradio' },
  { label: 'SoundCloud', url: 'https://soundcloud.com/eistcork' },
  { label: 'Mixcloud', url: 'https://www.mixcloud.com/eistcork/' },
  { label: 'Website', url: 'https://eist.radio' },
  { label: 'Email', url: 'mailto:info@eist.radio' },
  { label: 'Support éist', url: 'https://eist.radio/support/' },
];

export default function ConnectScreen(_props: { pageIndex: number; isActive: boolean }) {
  return (
    <PageScaffold liveNow>
      <Eyebrow>links</Eyebrow>
      <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ gap: 22, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {LINKS.map((l) => (
          <Pressable key={l.url} onPress={() => Linking.openURL(l.url)}>
            <Text style={{ fontFamily: font.headingBold, fontWeight: '700', fontSize: 42, lineHeight: 43, letterSpacing: -0.8, color: colors.green }}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[type.eyebrow, { color: colors.textDim }]}>
        éist · Cork, Ireland
      </Text>
    </PageScaffold>
  );
}
