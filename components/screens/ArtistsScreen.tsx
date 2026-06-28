import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, type } from '../../theme/tokens';
import { useArtists } from '../../hooks/useArtists';
import { PageScaffold } from '../ui/PageScaffold';
import { Pills } from '../ui/Pills';
import { Eyebrow } from '../ui/Eyebrow';

export default function ArtistsScreen({ pageIndex }: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { artists } = useArtists();

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>Hosts</Eyebrow>
      <ScrollView style={{ marginTop: 32 }} showsVerticalScrollIndicator={false}>
        {artists.map((a) => (
          <Pressable key={a.slug} style={{ marginBottom: 30 }} onPress={() => router.push(`/artist/${a.slug}`)}>
            <Text style={[type.rowTitle, { color: colors.green }]}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}
