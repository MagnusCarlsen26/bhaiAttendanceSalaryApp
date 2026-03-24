import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

const MetricPill = ({ label, value, tone = 'neutral', style, compact = false }) => (
  <View style={[styles.base, compact && styles.compactBase, toneStyles[tone], style]}>
    {label ? <Text style={[styles.label, compact && styles.compactLabel, toneTextStyles[tone]]}>{label}</Text> : null}
    <Text style={[styles.value, compact && styles.compactValue, !label && styles.valueWithoutLabel, toneTextStyles[tone]]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  base: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginRight: 10,
  },
  compactBase: {
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginRight: 8,
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  compactLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
  },
  value: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: '800',
  },
  compactValue: {
    marginTop: 3,
    fontSize: 15,
  },
  valueWithoutLabel: {
    marginTop: 0,
    textAlign: 'center',
  },
});

const toneStyles = {
  neutral: { backgroundColor: colors.neutralSoft },
  present: { backgroundColor: colors.presentSoft },
  absent: { backgroundColor: colors.absentSoft },
  accent: { backgroundColor: '#e5dacb' },
};

const toneTextStyles = {
  neutral: { color: colors.neutral },
  present: { color: colors.present },
  absent: { color: colors.absent },
  accent: { color: colors.accentStrong },
};

export default MetricPill;
