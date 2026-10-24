import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useFitWidestWord } from '../hooks/useFitWidestWord';

interface FormattedShowTitleProps {
  title: string;
  color?: string;
  size?: number;
  style?: any;
  inline?: boolean;
  numberOfLines?: number;
  noWrap?: boolean;
  asContent?: boolean;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}

const FormattedShowTitleComponent: React.FC<FormattedShowTitleProps> = ({
  title,
  color = '#000',
  size = 16,
  style,
  inline = false,
  numberOfLines,
  noWrap = false,
  asContent = false,
  adjustsFontSizeToFit = false,
  minimumFontScale,
}) => {
  // Shrink so the widest word fits the width. RN's adjustsFontSizeToFit only shrinks on line overflow,
  // so a long single word still broke mid-word.
  const shrink = adjustsFontSizeToFit && !asContent;
  const baseStyle = StyleSheet.flatten([{ color, fontSize: size }, style]) as TextStyle;
  const fit = useFitWidestWord(title, baseStyle, minimumFontScale ?? 0.5);
  const scale = shrink ? fit.scale : 1;
  const fittedStyle =
    scale === 1
      ? null
      : {
          fontSize: (baseStyle.fontSize ?? size) * scale,
          ...(baseStyle.lineHeight != null && { lineHeight: baseStyle.lineHeight * scale }),
        };

  const iconSize = (Platform.OS === 'ios' ? size * 0.9 : size) * scale;

  // apply line constraints only when needed
  const lines = noWrap ? 1 : numberOfLines;
  // When shrinking to fit, numberOfLines must be set for adjustsFontSizeToFit to
  // take effect; long words shrink the whole title uniformly instead of breaking.
  const lineProps = adjustsFontSizeToFit
    ? {
        adjustsFontSizeToFit: true,
        minimumFontScale: minimumFontScale ?? 0.5,
        numberOfLines: (lines ?? 2) as number,
        ellipsizeMode: 'tail' as const,
      }
    : lines != null
      ? { numberOfLines: lines as number, ellipsizeMode: 'tail' as const }
      : {};

  const renderText = (children: React.ReactNode) => {
    const text = (
      <Text
        style={[{ color, fontSize: size }, style, fittedStyle]}
        {...lineProps}
        {...(Platform.OS === 'android' && { breakStrategy: 'simple' })}
        allowFontScaling={false}
      >
        {children}
      </Text>
    );
    if (!shrink) return text;
    return (
      <View onLayout={fit.onLayout}>
        {fit.measurer}
        {text}
      </View>
    );
  };

  // Case 1: exactly "éist arís"
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
              ...(Platform.OS === 'ios' && { marginTop: -1 }),
              ...(Platform.OS === 'android' && { marginTop: 0 }),
            }}
          />
        </>
      );
    }

    return renderText(
      <>
        {title}{' '}
        <Ionicons
          name="repeat"
          size={iconSize}
          color={color}
          style={{
            ...(Platform.OS === 'ios' && { marginTop: -1 }),
            ...(Platform.OS === 'android' && { marginTop: 0 }),
          }}
        />
      </>
    );
  }

  // Case 2: replace "(eíst arís)" variants with repeat icon
  const patterns = [
    /\(eist aris\)/gi,
    /\(éist arís\)/gi,
    /\(eíst arís\)/gi,
    /\(éist aris\)/gi,
    /\(éíst aris\)/gi,
    /\(éist áris\)/gi,
    /\(éíst árís\)/gi,
    /\(eist áris\)/gi,
    /\(eist arís\)/gi,
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
                ...(Platform.OS === 'ios' && { marginTop: -1 }),
                ...(Platform.OS === 'android' && { marginTop: 0 }),
              }}
            />
            {parts[1]}
          </>
        );
      }

      return renderText(
        <>
          {parts[0]}
          <Ionicons
            name="repeat"
            size={iconSize}
            color={color}
            style={{
              marginHorizontal: 2,
              ...(Platform.OS === 'ios' && { marginTop: -1 }),
              ...(Platform.OS === 'android' && { marginTop: 0 }),
            }}
          />
          {parts[1]}
        </>
      );
    }
  }

  // Default
  if (asContent) {
    return <>{title}</>;
  }
  return renderText(title);
};

export const FormattedShowTitle = React.memo(FormattedShowTitleComponent);

FormattedShowTitle.displayName = 'FormattedShowTitle';
