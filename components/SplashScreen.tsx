import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

interface SplashScreenProps {
  onComplete: () => void;
  assetsReady: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, assetsReady }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Only start fade when assets are ready AND minimum time has passed
    if (assetsReady) {
      // Stay static for 2 seconds after assets load, then fade out
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }).start(() => {
          onComplete();
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [assetsReady, fadeAnim, onComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image
        source={require('../assets/logo2.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 320,
    height: 320,
    // Use transform for more reliable positioning:
    transform: [
      { translateY: -130 },  // Move up (negative) or down (positive)
      { translateX: 0 },  // Move left (negative) or right (positive)
    ],
  },
});

export default SplashScreen;