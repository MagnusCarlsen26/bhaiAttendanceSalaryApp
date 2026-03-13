import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SectionCard from './SectionCard';
import { colors, type } from '../../theme/tokens';

const EmptyState = ({ title, subtitle }) => (
  <SectionCard style={styles.card} tinted>
    <View style={styles.marker} />
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </SectionCard>
);

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginTop: 18,
  },
  marker: {
    width: 42,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentSoft,
    marginBottom: 16,
  },
  title: {
    ...type.title,
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default EmptyState;
