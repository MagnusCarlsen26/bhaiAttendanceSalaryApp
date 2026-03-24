import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../../theme/tokens';

const SectionCard = ({ children, style, tinted = false, dense = false, themed = false }) => (
  <View style={[styles.card, tinted && styles.tinted, dense && styles.dense, themed && styles.themed, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...shadows.card,
  },
  tinted: {
    backgroundColor: colors.surfaceStrong,
  },
  dense: {
    padding: 13,
    borderRadius: radius.md,
  },
  themed: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.neutralBorder,
  },
});

export default SectionCard;
