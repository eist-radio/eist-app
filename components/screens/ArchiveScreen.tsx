import React, { useMemo, useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, font, type } from '../../theme/tokens';
import { useArchiveShows } from '../../hooks/useArchiveShows';
import { PageScaffold } from '../ui/PageScaffold';
import { Pills } from '../ui/Pills';
import { Eyebrow } from '../ui/Eyebrow';
import { Chevron } from '../ui/Chevron';
import { FormattedShowTitle } from '../FormattedShowTitle';

export default function ArchiveScreen({ pageIndex }: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { shows: items } = useArchiveShows();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        (it.artistName ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>archive</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Listen back</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search shows or hosts..."
        placeholderTextColor={colors.boneDim}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {filtered.map((it) => (
          <Pressable key={it.slug} style={s.row} onPress={() => router.push(`/archive/${it.slug}`)}>
            <View style={{ flex: 1 }}>
              <FormattedShowTitle title={it.title} color={colors.green} size={22} style={type.rowTitle} />
              <Text style={[type.rowSub, { color: colors.bone, marginTop: 4 }]}>{it.artistName}</Text>
            </View>
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
