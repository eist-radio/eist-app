import React, { useMemo, useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, font, type } from '../../theme/tokens';
import { useArtists } from '../../hooks/useArtists';
import { PageScaffold } from '../ui/PageScaffold';
import { Eyebrow } from '../ui/Eyebrow';
import { Chevron } from '../ui/Chevron';

export default function ArtistsScreen(_props: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { artists } = useArtists();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

  return (
    <PageScaffold liveNow>
      <Eyebrow>hosts</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Artists</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search hosts..."
        placeholderTextColor={colors.textDim}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {filtered.map((a) => (
          <Pressable key={a.slug} style={s.row} onPress={() => router.push(`/artist/${encodeURIComponent(a.slug)}?id=${encodeURIComponent(a.id)}`)}>
            <Text style={[type.rowTitle, { color: colors.green, flex: 1 }]}>{a.name}</Text>
            <Chevron direction="right" size={20} />
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  search: { fontFamily: font.body, fontWeight: '500', fontSize: 19, color: colors.green, marginTop: 18, paddingVertical: 4 },
});
