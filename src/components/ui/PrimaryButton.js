import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadows } from '../../theme/tokens';

const PrimaryButton = ({ label, onPress, style, textStyle, disabled = false }) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    <Text style={[styles.label, textStyle]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});

export default PrimaryButton;
