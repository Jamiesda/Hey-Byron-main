// app/_layout.tsx

import { Asset } from 'expo-asset';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SplashScreen from '../components/SplashScreen';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

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
          require('../assets/logo2.png'),
          require('../assets/hey.byronblack.png'),
          require('../assets/heybyron new.png'),
          require('../assets/logo3.png'),
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

  return (
    <View style={styles.container}>
      <StatusBar style={showSplash ? "light" : "auto"} />
      
      {/* App content renders immediately */}
      <Slot />
      
      {/* Splash overlay - stays until assets are loaded AND minimum time elapsed */}
      {showSplash && (
        <View style={StyleSheet.absoluteFillObject}>
          <SplashScreen 
            onComplete={handleSplashComplete}
            assetsReady={assetsLoaded}
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