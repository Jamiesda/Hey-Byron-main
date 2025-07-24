// app/admin/dashboard.tsx
// Simple navigation hub with logo button only
// @ts-nocheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const backgroundPattern = require('../../assets/background.png');
const heyByronBlackLogo = require('../../assets/heybyronhorizontallogo.png');

export default function Dashboard() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('Your Business');

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const businessCode = await AsyncStorage.getItem('businessCode');
      if (!businessCode) {
        router.replace('/admin/login');
        return;
      }
      // You can load business name here if needed
    } catch (error) {
      router.replace('/admin/login');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await AsyncStorage.removeItem('businessCode');
          router.replace('/admin/login');
        }
      }
    ]);
  };

  const navigateToMain = () => {
    router.push('/(tabs)');
  };

  return (
    <ImageBackground source={backgroundPattern} style={styles.background}>
      <LinearGradient 
        colors={[
          'rgb(16, 78, 78)', 
          'rgb(30, 120, 120)'
        ]} 
        style={styles.overlay}
      >
        <SafeAreaView style={styles.container}>
          
          {/* Logo Button - Replaces Main App button */}
          <TouchableOpacity
            style={styles.logoButton}
            onPress={navigateToMain}
          >
            <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
          </TouchableOpacity>

          {/* Logout Button - Top Right */}
          <TouchableOpacity 
            style={styles.logoutButtonTopRight} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            
            {/* Navigation Buttons */}
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={() => router.push('/admin/business-dashboard')}
            >
              <Text style={styles.navButtonEmoji}>🏢</Text>
              <Text style={styles.navButtonText}>Business Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.navButton} 
              onPress={() => router.push('/admin/events-dashboard')}
            >
              <Text style={styles.navButtonEmoji}>📅</Text>
              <Text style={styles.navButtonText}>Events Management</Text>
            </TouchableOpacity>

          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  container: { flex: 1 },
  logoButton: {
    position: 'absolute',
    left: 15,
    top: Platform.OS === 'ios' ? 60 : 40,
    padding: 1,
    zIndex: 10,
  },
  logoImage: {
    width: 150,
    height: 45,
  },
  logoutButtonTopRight: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'ios' ? 60 : 40,
    padding: 13,
    zIndex: 10,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60, // Space for logo
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  navButtonEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});