import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const strokeProps = (color) => ({
  stroke: color,
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const HomeIcon = ({ color = '#1f7dff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 11.5L12 4l9 7.5" {...strokeProps(color)} />
    <Path d="M6 12v7a1 1 0 001 1h10a1 1 0 001-1v-7" {...strokeProps(color)} />
    <Path d="M9 21V14h6v7" {...strokeProps(color)} />
  </Svg>
);

export const HistoryIcon = ({ color = '#1f7dff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" {...strokeProps(color)} />
    <Path d="M12 7v5.2l3 2" {...strokeProps(color)} />
    <Path d="M18.7 7.4a7.2 7.2 0 01-.6 3.5" {...strokeProps(color)} />
  </Svg>
);

export const SalaryIcon = ({ color = '#1f7dff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="6" width="16" height="12" rx="2.5" {...strokeProps(color)} />
    <Path d="M8 10h8" {...strokeProps(color)} />
    <Path d="M12 9v6" {...strokeProps(color)} />
    <Path d="M9.5 13c.7.8 1.5 1.2 2.5 1.2 1.4 0 2.4-.7 2.4-1.7 0-2.4-4.9-.8-4.9-3.5 0-1 1-1.8 2.5-1.8 1 0 1.8.3 2.5 1" {...strokeProps(color)} />
  </Svg>
);
