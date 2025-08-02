import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Text } from 'react-native';

interface FormattedShowTitleProps {
  title: string;
  color?: string;
  size?: number;
  style?: any;
  inline?: boolean;
  numberOfLines?: number;
  noWrap?: boolean;
  asContent?: boolean;
}

export const FormattedShowTitle: React.FC<FormattedShowTitleProps> = ({ 
  title, 
  color = '#000', 
  size = 16,
  style,
  inline = false,
  numberOfLines,
  noWrap = false,
  asContent = false
}) => {
  // Platform-specific icon sizing adjustments for better alignment
  const iconSize = Platform.OS === 'ios' ? size * 0.9 : size;
  
  // Case 1: If title is exactly "éist arís", add repeat icon at the end
  if (title === 'éist arís') {
    if (asContent) {
      return (
        <>
          {title}{' '}
          <Ionicons 
            name="repeat" 
            size={iconSize} 
            color={color} 
            style={{ 
              // Platform-specific adjustments for better alignment
              ...(Platform.OS === 'ios' && {
                marginTop: -1,
              }),
              ...(Platform.OS === 'android' && {
                marginTop: 0,
              }),
            }} 
          />
        </>
      );
    }
    
    return (
      <Text 
        style={[{ color, fontSize: size }, style]} 
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
        breakStrategy="simple"
        allowFontScaling={false}
      >
        {title}{' '}
        <Ionicons 
          name="repeat" 
          size={iconSize} 
          color={color} 
          style={{ 
            // Platform-specific adjustments for better alignment
            ...(Platform.OS === 'ios' && {
              marginTop: -1,
            }),
            ...(Platform.OS === 'android' && {
              marginTop: 0,
            }),
          }} 
        />
      </Text>
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
      
      if (asContent) {
        return (
          <>
            {parts[0]}
            <Ionicons 
              name="repeat" 
              size={iconSize} 
              color={color} 
              style={{ 
                marginHorizontal: 2,
                // Platform-specific adjustments for better alignment
                ...(Platform.OS === 'ios' && {
                  marginTop: -1,
                }),
                ...(Platform.OS === 'android' && {
                  marginTop: 0,
                }),
              }} 
            />
            {parts[1]}
          </>
        );
      }
      
      return (
        <Text 
          style={[{ color, fontSize: size }, style]} 
          numberOfLines={numberOfLines}
          ellipsizeMode="tail"
          breakStrategy="simple"
          allowFontScaling={false}
        >
          {parts[0]}
          <Ionicons 
            name="repeat" 
            size={iconSize} 
            color={color} 
            style={{ 
              marginHorizontal: 2,
              // Platform-specific adjustments for better alignment
              ...(Platform.OS === 'ios' && {
                marginTop: -1,
              }),
              ...(Platform.OS === 'android' && {
                marginTop: 0,
              }),
            }} 
          />
          {parts[1]}
        </Text>
      );
    }
  }

  // Default case: return title as is
  if (asContent) {
    return <>{title}</>;
  }
  return (
    <Text 
      style={[{ color, fontSize: size }, style]} 
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
      breakStrategy="simple"
      allowFontScaling={false}
    >
      {title}
    </Text>
  );
}; 