export const colors = {
  bg: '#f4efe7',
  bgSecondary: '#efe6da',
  surface: '#fffaf3',
  surfaceStrong: '#f7f0e5',
  surfaceTint: '#e9decf',
  surfaceWarm: '#fbf4ea',
  surfaceWarmStrong: '#f3e7d7',
  text: '#1f1a17',
  textMuted: '#74685d',
  textSoft: '#9a8d80',
  border: '#ddcfbe',
  accent: '#7a5c3e',
  accentStrong: '#34261a',
  accentSoft: '#c8b29b',
  present: '#28533a',
  presentSoft: '#e1efe4',
  absent: '#8f4c43',
  absentSoft: '#f7e6e2',
  neutral: '#645c54',
  neutralSoft: '#ece4d9',
  white: '#ffffff',
  overlay: 'rgba(28, 20, 13, 0.38)',
  presentBorder: '#bfd2c5',
  absentBorder: '#e0c4be',
  neutralBorder: '#d8c9b8',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999,
};

export const type = {
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  hero: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.text,
  },
  metric: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.text,
  },
};

export const shadows = {
  card: {
    shadowColor: '#3a2c1f',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};
