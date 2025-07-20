import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

interface FormattedShowTitleProps {
  title: string;
  color?: string;
  size?: number;
  style?: any;
  inline?: boolean;
  numberOfLines?: number;
}

export const FormattedShowTitle: React.FC<FormattedShowTitleProps> = ({ 
  title, 
  color = '#000', 
  size = 16,
  style,
  inline = false,
  numberOfLines
}) => {
  // Case 1: If title is exactly "éist arís", add repeat icon at the end
  if (title === 'éist arís') {
    if (inline) {
      return (
        <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
          {title}{' '}
          <Ionicons name="repeat" size={size} color={color} />
        </Text>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
          {title}
        </Text>
        <Ionicons name="repeat" size={size} color={color} style={{ marginLeft: 4 }} />
      </View>
    );
  }

  // Case 2: If title contains "(eist aris)" or "(éist arís)" in parentheses, replace with repeat icon
  // Handle both accent variations: e/é and i/í
  const patterns = [
    /\(eist aris\)/gi,  // (eist aris) - no accents
    /\(éist arís\)/gi,  // (éist arís) - with accents
    /\(éist aris\)/gi,  // (éist aris) - e with accent, i without
    /\(eist arís\)/gi   // (eist arís) - e without accent, i with
  ];

  for (const pattern of patterns) {
    if (pattern.test(title)) {
      const parts = title.split(pattern);
      if (inline) {
        return (
          <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
            {parts[0]}
            <Ionicons name="repeat" size={size} color={color} />
            {parts[1]}
          </Text>
        );
      }
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[{ color, fontSize: size }, style]} numberOfLines={numberOfLines}>
            {parts[0]}
          </Text>
          <Ionicons name="repeat" size={size} color={color} style={{ marginHorizontal: 2 }} />
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