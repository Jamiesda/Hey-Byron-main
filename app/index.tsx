// app/index.tsx - OPTIMIZED VERSION WITH CLEAN DARK THEME

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Pre-calculate screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Pre-require images to avoid loading delays
const logo = require('../assets/heybyronlogo.png');

export default function RootScreen() {
  const router = useRouter();
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();

  // Memoize navigation handlers to prevent recreations
  const navigateToPersonal = useCallback(() => {
    router.push('/(tabs)');
  }, [router]);

  const navigateToBusiness = useCallback(() => {
    router.push('/admin/login');
  }, [router]);

  // Optimized business redirect with early return
  useEffect(() => {
    if (businessId) {
      router.replace(`/(tabs)?businessId=${businessId}`);
    }
  }, [businessId, router]);

  // Memoize the gradient colors - clean dark gradient
  const gradientColors = useMemo(() => [
    '#1a1a1a', 
    '#2d2d2d', 
    '#1a1a1a'
  ] as const, []);

  // Early return for business redirect loading state
  if (businessId) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#4a9b8e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Image 
              source={logo} 
              style={styles.logo}
              resizeMode="contain"
              loadingIndicatorSource={require('../assets/logo2.png')}
            />
            <Text style={styles.tagline}>Discover • Connect • Experience</Text>
          </View>

          {/* Buttons Section */}
          <View style={styles.buttonSection}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={navigateToPersonal}
              activeOpacity={0.8}
              accessibilityLabel="Personal Interface"
              accessibilityHint="Browse events as a personal user"
            >
              <LinearGradient
                colors={['#4a9b8e', '#357a7a']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>PERSONAL</Text>
                <Text style={styles.buttonSubtext}>Discover Events</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.button} 
              onPress={navigateToBusiness}
              activeOpacity={0.8}
              accessibilityLabel="Business Dashboard"
              accessibilityHint="Access business management tools"
            >
              <LinearGradient
                colors={['#c2a478', '#a08960']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>BUSINESS</Text>
                <Text style={styles.buttonSubtext}>Manage Events</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

RootScreen.options = { headerShown: false };

// Clean dark theme styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 80,
    paddingVertical: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 90,
  },
  logo: {
    width: '90%',
    height: 250,
    marginBottom: -40,
    // White drop shadow
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: '300',
  },
  buttonSection: {
    gap: 24,
    marginTop: 190,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 2,
  },
  buttonSubtext: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});