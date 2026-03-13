import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

const Screen = ({ children, padded = true, style }) => (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.backgroundOrbTop} />
    <View style={styles.backgroundOrbBottom} />
    <View style={[styles.content, padded && styles.padded, style]}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#ead9c1',
    opacity: 0.7,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    left: -70,
    bottom: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e8dece',
    opacity: 0.5,
  },
});

export default Screen;
