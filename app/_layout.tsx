// app/_layout.tsx
// Updated with Firebase cache preloading during splash

import { Asset } from 'expo-asset';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SplashScreen from '../components/SplashScreen';

// Import cache preloading
import { loadEventsAndBusinessesCached } from '../utils/firebaseUtils';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [cachePreloaded, setCachePreloaded] = useState(false);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Preload assets using Expo's Asset.loadAsync
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // Preload the critical assets that cause loading delays
        await Asset.loadAsync([
          require('../assets/background.png'),
          require('../assets/hey(2).png'),
          require('../assets/heybyronhorizontallogo.png'),
        ]);
        
        console.log('Assets preloaded successfully');
        setAssetsLoaded(true);
      } catch (error) {
        console.error('Failed to load assets:', error);
        // Still mark as loaded to prevent infinite loading
        setAssetsLoaded(true);
      }
    };

    loadAssets();
  }, []);

  // NEW: Preload Firebase cache during splash
  useEffect(() => {
    const preloadCache = async () => {
      try {
        console.log('🚀 Preloading Firebase cache during splash...');
        
        // Start cache preload immediately (don't wait for assets)
        await loadEventsAndBusinessesCached();
        
        console.log('✅ Firebase cache preloaded successfully');
        setCachePreloaded(true);
      } catch (error) {
        console.error('❌ Failed to preload cache:', error);
        // Still mark as loaded to prevent infinite splash
        setCachePreloaded(true);
      }
    };

    preloadCache();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style={showSplash ? "light" : "auto"} />
      
      {/* App content renders immediately */}
      <Slot />
      
      {/* Splash overlay - stays until BOTH assets and cache are loaded */}
      {showSplash && (
        <View style={StyleSheet.absoluteFillObject}>
          <SplashScreen 
            onComplete={handleSplashComplete}
            assetsReady={assetsLoaded}
            cacheReady={cachePreloaded}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});