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

  return (
    <LinearGradient colors={theme.bgGradient} style={styles.container}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Top Branding (matching the top-left mortarboard design in screenshot) */}
      <View style={[styles.topBranding, { top: Math.max(insets.top, 12) }]}>
        <View style={styles.brandingLogoSquare}>
          <Ionicons name="school" size={16} color="#ffffff" />
        </View>
        <ThemedText style={[styles.brandingText, { color: isDarkMode ? '#fdf6ee' : '#4a2d1b' }]}>PATHFINDER</ThemedText>
      </View>

      {/* Theme Toggle Button (Glassmorphic) */}
      <Pressable
        onPress={toggleTheme}
        style={[
          styles.themeToggle,
          {
            top: Math.max(insets.top, 12),
            backgroundColor: isDarkMode ? 'rgba(40, 27, 18, 0.4)' : 'rgba(255, 255, 255, 0.4)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.4)',
          },
        ]}
      >
        <FontAwesome
          name={isDarkMode ? 'sun-o' : 'moon-o'}
          size={18}
          color={isDarkMode ? '#ff7e40' : '#4a2d1b'}
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
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {/* Center Logo Area in Card */}
            <View style={styles.cardLogoWrapper}>
              <View style={styles.cardLogoSquare}>
                <Ionicons name="sunny" size={24} color="#ff7e40" />
              </View>
            </View>

            {/* Title & Subtitle */}
            <View style={styles.cardHeader}>
              <ThemedText style={[styles.title, { color: isDarkMode ? '#fdf6ee' : '#4a2d1b' }]}>Sign In</ThemedText>
              <View style={styles.underlineBar} />
              <ThemedText style={styles.subtitle}>Ready to continue your journey?</ThemedText>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Identity (Email/Username) Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>USERNAME</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: emailFocused ? theme.primary : theme.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <FontAwesome name="user-o" size={16} color={emailFocused ? theme.primary : '#9ca3af'} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: isDarkMode ? '#fdf6ee' : '#4a2d1b' }]}
                    placeholder="Your username"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Secret Key (Password) Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>PASSWORD</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: passwordFocused ? theme.primary : theme.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <FontAwesome name="lock" size={18} color={passwordFocused ? theme.primary : '#9ca3af'} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: isDarkMode ? '#fdf6ee' : '#4a2d1b', paddingRight: 40 }]}
                    placeholder="Your password"
                    placeholderTextColor="#9ca3af"
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
                    <FontAwesome
                      name={showPassword ? 'eye-slash' : 'eye'}
                      size={16}
                      color="#9ca3af"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Remember Me and Forgot row */}
              <View style={styles.extrasRow}>
                <Pressable
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: theme.inputBorder },
                      rememberMe && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                  >
                    {rememberMe && <FontAwesome name="check" size={8} color="#ffffff" />}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Remember Me</ThemedText>
                </Pressable>

                <Pressable onPress={handleForgot}>
                  <ThemedText style={styles.forgotText}>Forgot?</ThemedText>
                </Pressable>
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.loginButtonContainer,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  loading && { opacity: 0.7 },
                ]}
              >
                <LinearGradient
                  colors={theme.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButton}
                >
                  {loading ? (
                    <View style={styles.loadingWrapper}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <ThemedText style={styles.loginButtonText}>AUTHORIZING...</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.btnContent}>
                      <ThemedText style={styles.loginButtonText}>SECURE SIGN IN</ThemedText>
                      <FontAwesome name="arrow-right" size={11} color="#ffffff" style={styles.arrowIcon} />
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.cardFooter}>
              <ThemedText style={styles.footerText}>
                Empowering Tomorrow's Leaders © 2026
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBranding: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandingLogoSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff7e40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  brandingText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  card: {
    width: Math.min(SCREEN_WIDTH * 0.9, 400),
    borderRadius: 48,
    borderWidth: 1,
    paddingTop: 36,
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'stretch',
    shadowColor: '#4a2d1b',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 6,
    overflow: 'hidden',
  },
  cardLogoWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLogoSquare: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4a2d1b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  underlineBar: {
    width: 28,
    height: 2,
    backgroundColor: '#ff7e40',
    borderRadius: 1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6e7f8d',
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
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8b7a70',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
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
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6e7f8d',
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ff7e40',
  },
  loginButtonContainer: {
    marginTop: 10,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ff7e40',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  loginButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  arrowIcon: {
    marginLeft: 6,
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardFooter: {
    alignItems: 'center',
    marginTop: 36,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#a0aebc',
  },
});
