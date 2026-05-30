import { View } from 'react-native';

import { ThemeColor } from '@/constants/theme.js';
import { useTheme } from '@/hooks/use-theme.js';



export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
