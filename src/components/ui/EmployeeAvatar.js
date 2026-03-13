import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';

const EmployeeAvatar = ({ name, tone = 'neutral' }) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, toneStyles[tone]]}>
      <Text style={[styles.text, toneTextStyles[tone]]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
  },
});

const toneStyles = {
  neutral: { backgroundColor: colors.neutralSoft },
  present: { backgroundColor: colors.presentSoft },
  absent: { backgroundColor: colors.absentSoft },
};

const toneTextStyles = {
  neutral: { color: colors.neutral },
  present: { color: colors.present },
  absent: { color: colors.absent },
};

export default EmployeeAvatar;
