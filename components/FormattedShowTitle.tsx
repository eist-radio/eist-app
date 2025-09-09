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

const FormattedShowTitleComponent: React.FC<FormattedShowTitleProps> = ({
  title,
  color = '#000',
  size = 16,
  style,
  inline = false,
  numberOfLines,
  noWrap = false,
  asContent = false,
}) => {
  const iconSize = Platform.OS === 'ios' ? size * 0.9 : size;

  // apply line constraints only when needed
  const lines = noWrap ? 1 : numberOfLines;
  const lineProps =
    lines != null ? { numberOfLines: lines as number, ellipsizeMode: 'tail' as const } : {};

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

    return (
      <Text
        style={[{ color, fontSize: size }, style]}
        {...lineProps}
        {...(Platform.OS === 'android' && { breakStrategy: 'simple' })}
        allowFontScaling={false}
      >
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
      </Text>
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

      return (
        <Text
          style={[{ color, fontSize: size }, style]}
          {...lineProps}
          {...(Platform.OS === 'android' && { breakStrategy: 'simple' })}
          allowFontScaling={false}
        >
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
        </Text>
      );
    }
  }

  // Default
  if (asContent) {
    return <>{title}</>;
  }
  return (
    <Text
      style={[{ color, fontSize: size }, style]}
      {...lineProps}
      {...(Platform.OS === 'android' && { breakStrategy: 'simple' })}
      allowFontScaling={false}
    >
      {title}
    </Text>
  );
};

export const FormattedShowTitle = React.memo(FormattedShowTitleComponent);

FormattedShowTitle.displayName = 'FormattedShowTitle';
