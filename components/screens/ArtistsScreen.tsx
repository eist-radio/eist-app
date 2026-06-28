import React, { useMemo, useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, font, type } from '../../theme/tokens';
import { useArtists } from '../../hooks/useArtists';
import { PageScaffold } from '../ui/PageScaffold';
import { Pills } from '../ui/Pills';
import { Eyebrow } from '../ui/Eyebrow';

export default function ArtistsScreen({ pageIndex }: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { artists } = useArtists();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>Hosts</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>People of éist</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search hosts"
        placeholderTextColor={colors.lilac}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {filtered.map((a) => (
          <Pressable key={a.slug} style={{ marginBottom: 30 }} onPress={() => router.push(`/artist/${encodeURIComponent(a.slug)}?id=${encodeURIComponent(a.id)}`)}>
            <Text style={[type.rowTitle, { color: colors.green }]}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  search: { fontFamily: font.body, fontWeight: '500', fontSize: 17, color: colors.green, marginTop: 18, paddingVertical: 4 },
});
