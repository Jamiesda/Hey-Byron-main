import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

interface SplashScreenProps {
  onComplete: () => void;
  assetsReady: boolean;
  cacheReady: boolean;  // NEW: Wait for cache too
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, assetsReady, cacheReady }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Wait for BOTH assets AND cache to be ready
    if (assetsReady && cacheReady) {
      console.log('✅ Assets and cache ready, starting splash fade...');
      
      // Shorter delay since cache is already loaded
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1000,  // Faster fade since work is done
          useNativeDriver: true,
        }).start(() => {
          onComplete();
        });
      }, 800); // Shorter delay since data is preloaded

      return () => clearTimeout(timer);
    }
  }, [assetsReady, cacheReady, fadeAnim, onComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Image
            source={require('../assets/hey(2).png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        {/* Optional: Loading indicator */}
        <View style={styles.loadingContainer}>
          {!assetsReady && (
            <Text style={styles.loadingText}>Loading assets...</Text>
          )}
          {assetsReady && !cacheReady && (
            <Text style={styles.loadingText}>Loading events...</Text>
          )}
          {assetsReady && cacheReady && (
            <Text style={styles.loadingText}>Ready!</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    width: '150%',           // EXACT same as welcome page
    height: 250,           // EXACT same as welcome page
    marginBottom: -40,     // EXACT same as welcome page
    // White drop shadow (same as welcome page)
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '300',
  },
});

export default SplashScreen;