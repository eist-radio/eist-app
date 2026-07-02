import React, { useEffect, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  // Debounce the input before hitting the backend so we don't fire a request
  // on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Search runs server-side via the `q` param; results (and their pagination)
  // come back already filtered, so we render `items` directly.
  const { shows: items, hasMore, loadMore, isLoadingMore, isLoading } =
    useArchiveShows(search);

  // Load the next page as the user nears the bottom. loadMore() already guards
  // against overlapping/duplicate fetches, so an eager threshold is safe.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (hasMore && distanceFromBottom < 600) loadMore();
  };

  return (
    <PageScaffold frozenLiveNow>
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
      <ScrollView style={{ flex: 1, marginTop: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
        {items.map((it) => (
          <Pressable key={it.slug} style={s.row} onPress={() => router.push(`/archive/${it.slug}`)}>
            <View style={{ flex: 1 }}>
              <FormattedShowTitle title={it.title} color={colors.green} size={26} style={type.rowTitle} />
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
        {!isLoading && items.length === 0 && (
          <Text style={[type.meta, { color: colors.textDim, marginTop: 8 }]}>
            {search ? `No shows match "${search}"` : 'No shows found'}
          </Text>
        )}
      </ScrollView>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  search: { fontFamily: font.body, fontWeight: '500', fontSize: 16, color: colors.green, marginTop: 18, paddingVertical: 4 },
});
