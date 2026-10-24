// app/carplay-log.tsx
// Hidden CarPlay debug log. Open eistapp://carplay-log in Safari to get here.

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { HeaderLeftNav } from '../components/ui/HeaderLeftNav';
import { PageScaffold } from '../components/ui/PageScaffold';
import { colors, type as t } from '../theme/tokens';
import { clearCarPlayLog, isCarPlayLogAvailable, readCarPlayLog } from '../utils/carPlayLog';

export default function CarPlayLogScreen() {
  const [log, setLog] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLog(await readCarPlayLog());
    } catch (error) {
      setLog(`Couldn't read the log: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clear = () => {
    clearCarPlayLog();
    setLog('');
  };

  const share = () => {
    void Share.share({ message: log });
  };

  const button = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[t.eyebrow, { color: colors.green }]}>{label}</Text>
    </Pressable>
  );

  return (
    <PageScaffold left={<HeaderLeftNav />}>
      <Text style={[t.pagehead, { color: colors.green }]}>CarPlay log</Text>
      <View style={{ flexDirection: 'row', gap: 24, marginVertical: 16 }}>
        {button('Refresh', () => void refresh())}
        {button('Share', share)}
        {button('Clear', clear)}
      </View>
      <ScrollView style={{ flex: 1 }}>
        <Text selectable style={{ color: colors.text, fontFamily: 'Menlo', fontSize: 11, lineHeight: 15 }}>
          {isCarPlayLogAvailable()
            ? log || 'Empty. Connect to CarPlay, then come back here.'
            : 'Only CarPlay builds keep this log.'}
        </Text>
      </ScrollView>
    </PageScaffold>
  );
}
