// app/admin/business-dashboard.tsx
// Business management separated from main dashboard
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
import { getErrorMessage } from '../../utils/errorHandling';

// Import Firebase functions
import {
    loadBusinessFromFirebase,
    saveBusinessToFirebase,
    uploadToFirebaseStorage
} from '../../utils/firebaseUtils';

// Import components
import { BusinessForm, BusinessFormData } from '../../components/business';

const backgroundPattern = require('../../assets/logo3.png');
const heyByronBlackLogo = require('../../assets/hey.byronblack.png');

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

  const handleBusinessImageSelected = async (uri: string) => {
    try {
      const ext = uri.split('.').pop() || 'jpg';
      const filename = `business_${Date.now()}.${ext}`;
      const uploadedUrl = await uploadToFirebaseStorage(uri, filename);
      setBusinessData(prev => ({ ...prev, image: uploadedUrl }));
    } catch (error) {
      console.error('Error uploading business image:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
    }
  };

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

      // Save to Firebase
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

  const navigateBack = () => {
    router.push('/admin/dashboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading business information...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="cover">
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.8)']} style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Dashboard</Text>
            </TouchableOpacity>
            
            <Image source={heyByronBlackLogo} style={styles.logo} resizeMode="contain" />
            
            <TouchableOpacity onPress={navigateToEvents} style={styles.eventsButton}>
              <Text style={styles.eventsButtonText}>Events →</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            style={styles.content} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              
              {/* Title */}
              <Text style={styles.title}>Business Information</Text>
              <Text style={styles.subtitle}>
                Manage your business profile and details
              </Text>

              {/* Business Form */}
              <BusinessForm
                businessData={businessData}
                onDataChange={handleBusinessDataChange}
                onImageSelected={handleBusinessImageSelected}
                onSave={saveBusiness}
                loading={savingBiz}
              />

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  logo: {
    height: 32,
    width: 120,
  },
  eventsButton: {
    padding: 8,
  },
  eventsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
  },
});