import React from 'react';
import { Linking, Platform, StyleSheet, Text, TextProps } from 'react-native';
import { detectUrls } from '../utils/urlDetection';

interface SelectableTextProps extends TextProps {
  text: string;
  style?: any;
  linkStyle?: any;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  selectable?: boolean;
}

export function SelectableText({ 
  text, 
  style, 
  linkStyle, 
  numberOfLines, 
  ellipsizeMode,
  selectable = true,
  ...rest
}: SelectableTextProps) {
  const segments = detectUrls(text);

  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  // Platform-specific text selection improvements
  const textSelectionProps = {
    selectable,
    allowFontScaling: true,
    ...(Platform.OS === 'ios' && {
      textBreakStrategy: 'simple' as const,
      adjustsFontSizeToFit: false,
    }),
    ...(Platform.OS === 'android' && {
      textAlignVertical: 'top' as const,
    }),
  };

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      {...textSelectionProps}
      {...rest}
    >
      {segments.map((segment, index) =>
        segment.type === 'link' && segment.url ? (
          <Text
            key={index}
            style={[linkStyle, styles.link]}
            onPress={() => handleLinkPress(segment.url!)}
            suppressHighlighting={true}
          >
            {segment.content}
          </Text>
        ) : (
          segment.content
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
}); 