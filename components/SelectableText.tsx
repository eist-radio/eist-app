import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { detectUrls } from '../utils/urlDetection';

interface SelectableTextProps {
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
  selectable = true
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

  // If no URLs detected, render as simple selectable text
  if (segments.length === 0) {
    return (
      <Text 
        style={style}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        selectable={selectable}
      >
        {text}
      </Text>
    );
  }

  // If URLs detected, render with link detection and selectable text
  return (
    <Text 
      style={style}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      selectable={selectable}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'link' && segment.url) {
          return (
            <Text
              key={index}
              style={[linkStyle, styles.link]}
              onPress={() => handleLinkPress(segment.url!)}
              selectable={false} // Links are not selectable, only clickable
            >
              {segment.content}
            </Text>
          );
        }
        return (
          <Text key={index} selectable={selectable}>
            {segment.content}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
}); 