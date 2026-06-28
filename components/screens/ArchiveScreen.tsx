import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, type } from '../../theme/tokens';
import { useArchiveShows } from '../../hooks/useArchiveShows';
import { PageScaffold } from '../ui/PageScaffold';
import { Pills } from '../ui/Pills';
import { Eyebrow } from '../ui/Eyebrow';
import { FormattedShowTitle } from '../FormattedShowTitle';

export default function ArchiveScreen({ pageIndex }: { pageIndex: number; isActive: boolean }) {
  const router = useRouter();
  const { shows: items } = useArchiveShows();

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>Archive</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Listen back</Text>
      <ScrollView style={{ marginTop: 36 }} showsVerticalScrollIndicator={false}>
        {items.map((it) => (
          <Pressable key={it.slug} style={s.row} onPress={() => router.push(`/archive/${it.slug}`)}>
            <View style={{ flex: 1 }}>
              <FormattedShowTitle title={it.title} color={colors.green} size={22} style={type.rowTitle} />
              <Text style={[type.rowSub, { color: colors.lilac, marginTop: 4 }]}>{it.artistName}</Text>
            </View>
            <View style={s.tri} />
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  tri: { width: 0, height: 0, borderLeftWidth: 13, borderLeftColor: colors.green, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent' },
});
