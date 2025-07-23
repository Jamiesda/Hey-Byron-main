// app/admin/login.tsx - EXPO FIREBASE VERSION
// @ts-nocheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ImageBackground,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ALLOWED_BUSINESS_CODES } from '../../data/allowedBusinessCodes';
import { db } from '../../firebaseConfig'; // Import from your config file

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const backgroundPattern = require('../../assets/logo3.png');
const heyByronLogo = require('../../assets/hey.byronblack.png');

// Set your admin code here - change this to something secure
const OWNER_ADMIN_CODE = 'OwnerAdmin2024';

export default function LoginScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      alert('Please enter a business code.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Check if it's the owner admin code
      if (trimmed === OWNER_ADMIN_CODE) {
        await AsyncStorage.setItem('isOwnerAdmin', 'true');
        router.replace('/admin/owner-dashboard');
        return;
      }
      
      // Load business codes from Firebase
      const businessCodesDoc = doc(db, 'admin', 'businessCodes');
      const businessCodesSnap = await getDoc(businessCodesDoc);
      
      let allowedCodes = ALLOWED_BUSINESS_CODES; // fallback
      
      if (businessCodesSnap.exists()) {
        const data = businessCodesSnap.data();
        allowedCodes = data.codes || ALLOWED_BUSINESS_CODES;
      }
      
      // Check if it's a valid business code
      if (!allowedCodes.includes(trimmed)) {
        alert('That business code is not recognized.');
        setLoading(false);
        return;
      }
      
      // Valid business code - proceed with login
      await AsyncStorage.setItem('businessCode', trimmed);
      await AsyncStorage.setItem('isBusiness', 'true');
      router.replace('/admin/dashboard');
      
    } catch (error) {
      console.error('Error during login:', error);
      alert('Error checking business code. Please try again.');
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={backgroundPattern} 
      style={styles.background}
      resizeMode="repeat"
    >
      <LinearGradient 
        colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.95)']} 
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe}>
        {/* Logo back button */}
        <TouchableOpacity
          style={styles.logoButton}
          onPress={() => router.push('/')}
        >
          <Image source={heyByronLogo} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Business Login</Text>
          <Text style={styles.subtitle}>Enter your business code to access the dashboard</Text>
        </View>

        {/* Login form */}
        <View style={styles.container}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Business Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your code"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={loading || !code.trim()}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.loginButtonText}>Checking code...</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Don't have a business code? Contact the app administrator for access.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

// No default header
LoginScreen.options = { headerShown: false };

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? 16 : 0,
  },
  logoButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 60 : 40,
    padding: 8,
    zIndex: 10,
  },
  logoImage: {
    width: 150,
    height: 24,
  },
  headerContainer: {
    marginTop: SCREEN_HEIGHT * 0.15,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  container: {
    marginHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  inputContainer: {
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(194, 164, 120, 0.6)',
  },
  loginButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpContainer: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
});