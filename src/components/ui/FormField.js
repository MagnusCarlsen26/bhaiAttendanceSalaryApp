import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, type } from '../../theme/tokens';

const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  children,
  style,
}) => (
  <View style={style}>
    <Text style={styles.label}>{label}</Text>
    {children || (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        keyboardType={keyboardType}
        style={styles.input}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  label: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
});

export default FormField;
