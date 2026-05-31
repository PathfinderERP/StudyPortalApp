/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// import '../global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#4a2d1b', // Dark brown
    background: '#fdf6ee',
    backgroundElement: '#f5ebe0',
    backgroundSelected: '#e3d5ca',
    textSecondary: '#6e7f8d', // Muted steel blue/gray
    bgGradient: ['#fdf3e7', '#fdfbf7'], // Cream/beige gradient
    cardBg: '#ffffff',
    cardBorder: 'rgba(255, 255, 255, 0.9)',
    inputBg: '#fffdfb',
    inputBorder: '#f2e8df',
    btnGradient: ['#ff7e40', '#ff9865'], // Orange gradient
    btnText: '#ffffff',
    primary: '#ff7e40', // Pathfinder Orange
  },
  dark: {
    text: '#fdf6ee',
    background: '#1a120b',
    backgroundElement: '#2c1e13',
    backgroundSelected: '#3c2a1a',
    textSecondary: '#a59489',
    bgGradient: ['#1e140f', '#120b08'],
    cardBg: 'rgba(40, 27, 18, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    inputBg: 'rgba(20, 12, 8, 0.5)',
    inputBorder: 'rgba(92, 70, 55, 0.5)',
    btnGradient: ['#ff7e40', '#ff9865'],
    btnText: '#ffffff',
    primary: '#ff7e40',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
