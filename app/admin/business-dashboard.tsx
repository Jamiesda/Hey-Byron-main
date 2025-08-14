// app/admin/business-dashboard.tsx
// Business management separated from main dashboard
// FIXED VERSION - Removed duplicate upload logic
// @ts-nocheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Import extracted utilities
import { validateBusinessData } from '../../constants/validation';
import { getErrorMessage } from '../../utils/ErrorHandling';

// Import Firebase functions
import {
  loadBusinessFromFirebase,
  saveBusinessToFirebase,
} from '../../utils/firebaseUtils';

// Import components
import { BusinessForm, BusinessFormData } from '../../components/business';

const backgroundPattern = require('../../assets/background.png');
const heyByronBlackLogo = require('../../assets/heybyronhorizontallogo.png');

export default function BusinessDashboard() {
  const router = useRouter();
  
  // Business state
  const [code, setCode] = useState<string | null>(null);
  const [businessData, setBusinessData] = useState<BusinessFormData>({
    name: '',
    address: '',
    description: '',
    tags: '',
    website: '',
    socialLinks: '',
    image: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [savingBiz, setSavingBiz] = useState(false);

  // Check access and load data
  useEffect(() => {
    checkBusinessAccess();
  }, []);

  const checkBusinessAccess = async () => {
    try {
      const businessCode = await AsyncStorage.getItem('businessCode');
      if (!businessCode) {
        router.replace('/admin/login');
        return;
      }
      
      setCode(businessCode);
      await loadBusinessData(businessCode);
    } catch (error) {
      console.error('Error checking business access:', error);
      router.replace('/admin/login');
    }
  };

  const loadBusinessData = async (businessCode: string) => {
    try {
      setLoading(true);
      
      const business = await loadBusinessFromFirebase(businessCode);
      if (business) {
        setBusinessData({
          name: business.name,
          address: business.address,
          description: business.description,
          tags: business.tags.join(', '),
          website: business.website || '',
          socialLinks: business.socialLinks?.join(', ') || '',
          image: business.image,
        });
      }
    } catch (error) {
      console.error('Error loading business data:', error);
      Alert.alert('Error', 'Failed to load business information');
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessDataChange = (data: Partial<BusinessFormData>) => {
    setBusinessData(prev => ({ ...prev, ...data }));
  };

  // REMOVED: handleBusinessImageSelected function entirely
  // The MediaPicker in BusinessForm now handles all image uploads directly
  // The image URL gets updated via handleBusinessDataChange when MediaPicker calls onUploadComplete

  const saveBusiness = async () => {
    try {
      setSavingBiz(true);
      
      // Validate data
      const errors = await validateBusinessData({
        name: businessData.name,
        address: businessData.address,
        description: businessData.description,
        website: businessData.website,
        tags: businessData.tags,
        socialLinks: businessData.socialLinks,
      });

      if (errors.length > 0) {
        Alert.alert('Validation Error', errors.join('\n'));
        return;
      }

      // Save to Firebase - businessData.image already contains the correct Firebase URL
      // from MediaPicker's onUploadComplete callback
      await saveBusinessToFirebase(businessData, code!);
      Alert.alert('Success', 'Business information saved!');
      
    } catch (error) {
      console.error('Error saving business:', error);
      const errorMsg = getErrorMessage(error, 'save business information');
      Alert.alert('Save Failed', errorMsg);
    } finally {
      setSavingBiz(false);
    }
  };

  const navigateToEvents = () => {
    router.push('/admin/events-dashboard');
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['businessCode', 'isBusiness']);
      router.replace('/');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
        <LinearGradient 
          colors={['rgba(255, 255, 255, 0.96)', 'rgb(30, 120, 120)']} 
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>Loading business information...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
      <LinearGradient 
        colors={['rgba(255, 255, 255, 0.96)', 'rgb(30, 120, 120)']} 
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.container}>
        
        {/* Logo Button - Same as login page */}
        <TouchableOpacity
          style={styles.logoButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>

        {/* Top Right Buttons */}
        <View style={styles.topRightButtons}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.eventsButtonTopRight} 
            onPress={navigateToEvents}
          >
            <Text style={styles.eventsButtonText}>Events →</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.content} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            
            {/* Business Form - UPDATED PROPS */}
            <BusinessForm
              businessData={businessData}
              onDataChange={handleBusinessDataChange}
              onSave={saveBusiness}
              loading={savingBiz}
              businessId={code!}
              // REMOVED: onImageSelected prop - MediaPicker handles everything
            />

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#1a1a1a',
    marginTop: 16,
    fontSize: 16,
  },
  logoButton: {
    position: 'absolute',
    left: 6,
    top: Platform.OS === 'ios' ? 25 : 5,
    padding: 8,
    zIndex: 10,
  },
  logoImage: {
    width: 150,
    height: 50,
  },
  topRightButtons: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'ios' ? 42 : 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 59, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsButtonTopRight: {
    padding: 8,
  },
  eventsButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 90 : 70,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
});