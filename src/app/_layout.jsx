import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { storage } from '../utils/storage';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    async function checkAuthToken() {
      try {
        const token = await storage.getItem('userToken');
        setHasToken(!!token);
      } catch (err) {
        console.error('Error reading auth token:', err);
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    }
    checkAuthToken();
  }, []);

  useEffect(() => {
    if (loading) return;

    async function verifyAndNavigate() {
      try {
        const token = await storage.getItem('userToken');
        const tokenExists = !!token;
        const inDashboard = segments[0] === 'dashboard';

        if (!tokenExists && inDashboard) {
          // If not logged in and trying to access dashboard, redirect to login
          router.replace('/');
        } else if (tokenExists && !inDashboard) {
          // If logged in and on the login/landing screen, redirect to dashboard
          router.replace('/dashboard');
        }
      } catch (err) {
        console.error('Error verifying auth:', err);
      }
    }

    verifyAndNavigate();
  }, [segments, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fdf6ee' }}>
        <ActivityIndicator size="large" color="#ff7e40" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
