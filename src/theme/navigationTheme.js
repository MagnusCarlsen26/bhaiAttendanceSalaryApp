import { DefaultTheme } from '@react-navigation/native';
import { colors } from './tokens';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accentStrong,
    notification: colors.accent,
  },
};

export default navigationTheme;
