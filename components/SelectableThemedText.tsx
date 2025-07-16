import { useThemeColor } from '@/hooks/useThemeColor';
import React from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

export type SelectableThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  selectable?: boolean;
  children?: React.ReactNode;
};

export function SelectableThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  selectable = true,
  children,
  ...rest
}: SelectableThemedTextProps) {
   const colorKey = type === 'link' ? 'tint' : 'text';
   const color = useThemeColor({ light: lightColor, dark: darkColor }, colorKey);

   // Platform-specific text selection improvements
   const textSelectionProps = {
     selectable,
     allowFontScaling: true,
     // iOS-specific improvements for better text selection
     ...(Platform.OS === 'ios' && {
       textBreakStrategy: 'simple' as const,
       adjustsFontSizeToFit: false,
     }),
     // Android-specific improvements for better text selection
     ...(Platform.OS === 'android' && {
       textAlignVertical: 'top' as const,
     }),
   };

   return (
     <Text
       style={[
         { color },
         type === 'default' ? styles.default : undefined,
         type === 'title' ? styles.title : undefined,
         type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
         type === 'subtitle' ? styles.subtitle : undefined,
         type === 'link' ? styles.link : undefined,
         style,
       ]}
       {...textSelectionProps}
       {...rest}
     >
       {children}
     </Text>
   );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
}); 