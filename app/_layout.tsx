import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, SplashScreen } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export {
  // Ensure all navigation screens use the default Stack layout
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('token');
      setIsAuthenticated(!!token); // varsa true, yoksa false
      setIsAuthChecked(true);
    };

    checkToken();
  }, []);

  if (!loaded || !isAuthChecked) {
    SplashScreen.preventAutoHideAsync();
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Auth kontrolüne göre hangi layout çalışacak onu seçiyoruz */}
      <Slot initialRouteName={isAuthenticated ? '(tabs)' : '(auth)'} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
