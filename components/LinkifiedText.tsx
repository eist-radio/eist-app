import React from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import { detectUrls } from '../utils/urlDetection';

interface LinkifiedTextProps {
  text: string;
  style?: any;
  linkStyle?: any;
  onPress?: () => void;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
}

export function LinkifiedText({ 
  text, 
  style, 
  linkStyle, 
  onPress, 
  numberOfLines, 
  ellipsizeMode 
}: LinkifiedTextProps) {
  const segments = detectUrls(text);

  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Cannot Open Link',
          'This link cannot be opened on this device.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      Alert.alert(
        'Error',
        'Failed to open the link. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (segments.length === 0) {
    return (
      <Text 
        style={style} 
        onPress={onPress}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
      >
        {text}
      </Text>
    );
  }

  return (
    <Text 
      style={style}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'link' && segment.url) {
          return (
            <Text
              key={index}
              style={[linkStyle, styles.link]}
              onPress={() => handleLinkPress(segment.url!)}
            >
              {segment.content}
            </Text>
          );
        }
        return (
          <Text key={index}>
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