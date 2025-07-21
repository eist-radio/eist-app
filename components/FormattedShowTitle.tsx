import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Text, View } from 'react-native';

interface FormattedShowTitleProps {
  title: string;
  color?: string;
  size?: number;
  style?: any;
  inline?: boolean;
  numberOfLines?: number;
  noWrap?: boolean;
}

export const FormattedShowTitle: React.FC<FormattedShowTitleProps> = ({ 
  title, 
  color = '#000', 
  size = 16,
  style,
  inline = false,
  numberOfLines,
  noWrap = false
}) => {
  // Platform-specific icon sizing adjustments for better alignment
  const iconSize = Platform.OS === 'ios' ? size * 0.9 : size;
  
  // Case 1: If title is exactly "éist arís", add repeat icon at the end
  if (title === 'éist arís') {
    return (
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        flexShrink: noWrap ? 0 : 1
      }}>
        <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
          {title}
        </Text>
        <Ionicons 
          name="repeat" 
          size={iconSize} 
          color={color} 
          style={{ 
            marginLeft: 4,
            flexShrink: 0,
            // Platform-specific adjustments for better alignment
            ...(Platform.OS === 'ios' && {
              marginTop: -1,
            }),
            ...(Platform.OS === 'android' && {
              marginTop: 0,
            }),
          }} 
        />
      </View>
    );
  }

  // Case 2: If title contains "(eist aris)" or "(éist arís)" in parentheses, replace with repeat icon
  // Handle both accent variations: e/é and i/í
  const patterns = [
    /\(eist aris\)/gi,  // (eist aris) - no fadas
    /\(éist arís\)/gi,  // (éist arís) - with fadas
    /\(éist aris\)/gi,  // (éist aris) - e with accent, i without
    /\(eist arís\)/gi   // (eist arís) - e without accent, i with
  ];

  for (const pattern of patterns) {
    if (pattern.test(title)) {
      const parts = title.split(pattern);
      return (
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          flexShrink: noWrap ? 0 : 1
        }}>
          <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
            {parts[0]}
          </Text>
          <Ionicons 
            name="repeat" 
            size={iconSize} 
            color={color} 
            style={{ 
              marginHorizontal: 2,
              flexShrink: 0,
              // Platform-specific adjustments for better alignment
              ...(Platform.OS === 'ios' && {
                marginTop: -1,
              }),
              ...(Platform.OS === 'android' && {
                marginTop: 0,
              }),
            }} 
          />
          <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
            {parts[1]}
          </Text>
        </View>
      );
    }
  }

  // Default case: return title as is
  return <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>{title}</Text>;
}; 