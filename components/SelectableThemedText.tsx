import { useThemeColor } from '@/hooks/useThemeColor';
import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

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
       selectable={selectable}
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