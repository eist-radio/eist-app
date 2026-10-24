import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextStyle, View } from 'react-native';

// Font scale so the widest word fits the box width, so long words shrink instead of breaking mid-word.
// Render `measurer` next to the text and pass `onLayout` to the text's container.
export function useFitWidestWord(text: string, baseStyle: TextStyle, minScale = 0.5) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [wordWidth, setWordWidth] = useState(0);

  // One word per line, so each measured line width is a word width.
  const wordsByLine = useMemo(() => text.trim().split(/\s+/).join('\n'), [text]);

  // 2% headroom for rounding differences between the measurer and the real text.
  const fitWidth = boxWidth * 0.98;
  const scale = boxWidth > 0 && wordWidth > fitWidth ? Math.max(minScale, fitWidth / wordWidth) : 1;

  const onLayout = (e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width);

  const measurer = (
    <View style={styles.measurer} pointerEvents="none" aria-hidden>
      <Text
        style={baseStyle}
        allowFontScaling={false}
        onTextLayout={(e) => setWordWidth(Math.max(0, ...e.nativeEvent.lines.map((l) => l.width)))}
      >
        {wordsByLine}
      </Text>
    </View>
  );

  return { scale, onLayout, measurer };
}

const styles = StyleSheet.create({
  measurer: { position: 'absolute', left: 0, top: 0, width: 4000, opacity: 0 },
});
