import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { storage } from '../utils/storage';

import { Colors } from '../constants/theme';
import { ThemedText } from '../components/themed-text';
import { useColorScheme } from '../hooks/use-color-scheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();

  // Theme management: support manual toggle overriding system scheme
  const [localTheme, setLocalTheme] = useState(null);
  const currentScheme = localTheme || systemScheme || 'light';
  const theme = Colors[currentScheme];
  const isDarkMode = currentScheme === 'dark';

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Input focus styling helper
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const toggleTheme = () => {
    setLocalTheme(currentScheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: email.trim(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // DRF SimpleJWT puts error messages inside the "detail" key
        setError(data.detail || data.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Save the JWT access token securely on the device
      if (data.access) {
        await storage.setItem('userToken', data.access);
      }
      if (data.refresh) {
        await storage.setItem('refreshToken', data.refresh);
      }
      
      // Save user details by fetching profile immediately
      try {
        const profileResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/profile/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${data.access}`,
            'Content-Type': 'application/json',
          },
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          await storage.setItem('userInfo', JSON.stringify(profileData));
        } else {
          await storage.setItem('userInfo', JSON.stringify({ email: email }));
        }
      } catch (profileErr) {
        console.warn('Failed to fetch user profile on login:', profileErr);
        await storage.setItem('userInfo', JSON.stringify({ email: email }));
      }

      setLoading(false);
      router.replace('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Server not responding. Please check your network connection.');
      setLoading(false);
    }
  };

  const handleForgot = () => {
    setError('Contact administrator to reset secret key.');
  };

  // Colors matching the screenshot design precisely
  const pageBg = isDarkMode ? '#090d16' : '#FAF8F5';
  const cardBg = isDarkMode ? '#101726' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1e293b' : 'transparent';
  const brandTextColor = isDarkMode ? '#FFFFFF' : '#040b1e';
  const labelTextColor = isDarkMode ? '#8b9bb4' : '#64748B';
  const subtitleColor = isDarkMode ? '#8b9bb4' : '#64748B';
  const inputBg = isDarkMode ? '#090d16' : '#F8F6F3';
  const inputBorder = isDarkMode ? '#1e293b' : '#EBE9E6';
  const inputText = isDarkMode ? '#FFFFFF' : '#040b1e';
  const orangeBrandColor = '#FF8E29'; // Clean orange from screenshot

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Theme Toggle Button (neat and floating) */}
      <Pressable
        onPress={toggleTheme}
        style={[
          styles.themeToggle,
          {
            top: Math.max(insets.top, 12),
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            borderColor: isDarkMode ? '#1e293b' : '#EBE9E6',
          },
        ]}
      >
        <FontAwesome
          name={isDarkMode ? 'sun-o' : 'moon-o'}
          size={16}
          color={isDarkMode ? '#ff8e29' : '#040b1e'}
        />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Branding (Pathfinder logo) */}
          <View style={styles.brandingHeader}>
            <View style={styles.brandingLogoCircle}>
              <Ionicons name="sunny" size={16} color="#ffffff" />
            </View>
            <ThemedText style={[styles.brandingHeaderText, { color: brandTextColor }]}>PATHFINDER</ThemedText>
          </View>

          {/* Login Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            {/* Orange circular badge with P */}
            <View style={styles.pBadge}>
              <ThemedText style={styles.pBadgeText}>P</ThemedText>
            </View>

            {/* Title & Subtitle */}
            <View style={styles.cardHeader}>
              <ThemedText style={[styles.title, { color: brandTextColor }]}>Sign In</ThemedText>
              <ThemedText style={[styles.subtitle, { color: subtitleColor }]}>Ready to continue your journey?</ThemedText>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Username Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: labelTextColor }]}>USERNAME</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputBg,
                      borderColor: emailFocused ? orangeBrandColor : inputBorder,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: inputText }]}
                    placeholder="Your username"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: labelTextColor }]}>PASSWORD</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputBg,
                      borderColor: passwordFocused ? orangeBrandColor : inputBorder,
                    },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: inputText, paddingRight: 40 }]}
                    placeholder="Your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#94A3B8"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Extras Row */}
              <View style={styles.extrasRow}>
                <Pressable
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: isDarkMode ? '#1e293b' : '#EBE9E6' },
                      rememberMe && { backgroundColor: orangeBrandColor, borderColor: orangeBrandColor },
                    ]}
                  >
                    {rememberMe && <Ionicons name="checkmark" size={10} color="#ffffff" />}
                  </View>
                  <ThemedText style={[styles.checkboxLabel, { color: labelTextColor }]}>Remember Me</ThemedText>
                </Pressable>

                <Pressable onPress={handleForgot}>
                  <ThemedText style={[styles.forgotText, { color: orangeBrandColor }]}>Forgot?</ThemedText>
                </Pressable>
              </View>

              {/* Sign In Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.loginButton,
                  { backgroundColor: orangeBrandColor },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  loading && { opacity: 0.7 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <ThemedText style={styles.loginButtonText}>Secure Sign In</ThemedText>
                )}
              </Pressable>
            </View>
          </View>

          {/* Footer Text */}
          <ThemedText style={[styles.footerText, { color: labelTextColor }]}>
            EMPOWERING TOMORROW'S LEADERS © 2026
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  themeToggle: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  brandingLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF8E29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingHeaderText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  card: {
    width: Math.min(SCREEN_WIDTH * 0.9, 440),
    borderRadius: 36,
    borderWidth: 1,
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 36,
    alignItems: 'stretch',
    shadowColor: '#040b1e',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 4,
    marginBottom: 24,
  },
  pBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF8E29',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  pBadgeText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 18,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '600',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  extrasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '900',
  },
  loginButton: {
    height: 52,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
