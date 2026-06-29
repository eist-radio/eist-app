import React, { useMemo, useState } from 'react';
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, font, type } from '../../theme/tokens';
import { useArchiveShows } from '../../hooks/useArchiveShows';
import { PageScaffold } from '../ui/PageScaffold';
import { Eyebrow } from '../ui/Eyebrow';
import { Chevron } from '../ui/Chevron';
import { FormattedShowTitle } from '../FormattedShowTitle';

function formatDate(isoString?: string): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ArchiveScreen(_props: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { shows: items, hasMore, loadMore, isLoadingMore } = useArchiveShows();
  const [query, setQuery] = useState('');

  // Load the next page as the user nears the bottom. loadMore() already guards
  // against overlapping/duplicate fetches, so an eager threshold is safe.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (hasMore && distanceFromBottom < 600) loadMore();
  };

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
    <PageScaffold liveNow>
      <Eyebrow>archive</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Listen back</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search shows or hosts..."
        placeholderTextColor={colors.textDim}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
        {filtered.map((it) => (
          <Pressable key={it.slug} style={s.row} onPress={() => router.push(`/archive/${it.slug}`)}>
            <View style={{ flex: 1 }}>
              <FormattedShowTitle title={it.title} color={colors.green} size={22} style={type.rowTitle} />
              <Text style={[type.rowSub, { color: colors.text, marginTop: 4 }]}>{it.artistName}</Text>
              {formatDate(it.start) && (
                <Text style={[type.meta, { color: colors.textDim, marginTop: 2 }]}>{formatDate(it.start)}</Text>
              )}
            </View>
            <Chevron direction="right" size={20} />
          </Pressable>
        ))}
        {isLoadingMore && (
          <ActivityIndicator color={colors.green} style={{ marginBottom: 30 }} />
        )}
      </ScrollView>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  search: { fontFamily: font.body, fontWeight: '500', fontSize: 19, color: colors.green, marginTop: 18, paddingVertical: 4 },
});
