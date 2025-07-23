// app/admin/owner-dashboard.tsx - Your Version with Firebase Integration
// @ts-nocheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ALLOWED_BUSINESS_CODES } from '../../data/allowedBusinessCodes';
import { Business } from '../../data/businesses';
import { Event } from '../../data/events';
import { db } from '../../firebaseConfig';
import {
  loadBusinessesFromFirebase,
  loadEventsFromFirebase
} from '../../utils/firebaseUtils';

const backgroundPattern = require('../../assets/logo3.png');
const heyByronLogo = require('../../assets/hey.byronblack.png');

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Business code management
  const [newBusinessCode, setNewBusinessCode] = useState('');
  const [businessCodes, setBusinessCodes] = useState<string[]>([]);
  const [creatingCode, setCreatingCode] = useState(false);
  const [deletingCodes, setDeletingCodes] = useState<Set<string>>(new Set());
  
  // App overview data
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    totalEvents: 0,
    activeEvents: 0,
    pastEvents: 0
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const isOwnerAdmin = await AsyncStorage.getItem('isOwnerAdmin');
      if (!isOwnerAdmin) {
        router.replace('/admin/login');
        return;
      }
      await loadAdminData();
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.replace('/admin/login');
    }
  };

  const loadAdminData = async () => {
    try {
      // Load business codes from Firebase
      try {
        const businessCodesDoc = doc(db, 'admin', 'businessCodes');
        const businessCodesSnap = await getDoc(businessCodesDoc);
        
        if (businessCodesSnap.exists()) {
          const data = businessCodesSnap.data();
          setBusinessCodes(data.codes || ALLOWED_BUSINESS_CODES);
        } else {
          // Initialize with default codes if none exist in Firebase
          setBusinessCodes(ALLOWED_BUSINESS_CODES);
          // Save default codes to Firebase
          await setDoc(businessCodesDoc, { codes: ALLOWED_BUSINESS_CODES });
        }
      } catch (error) {
        console.error('Error loading business codes from Firebase:', error);
        setBusinessCodes(ALLOWED_BUSINESS_CODES);
      }
      
      // Load businesses and events from Firebase
      const [businessList, eventList] = await Promise.all([
        loadBusinessesFromFirebase(),
        loadEventsFromFirebase()
      ]);
      
      setBusinesses(businessList);
      setEvents(eventList);
      
      // Calculate stats
      const now = new Date();
      const activeEvents = eventList.filter(event => new Date(event.date) > now);
      const pastEvents = eventList.filter(event => new Date(event.date) <= now);
      
      setStats({
        totalBusinesses: businessList.length,
        totalEvents: eventList.length,
        activeEvents: activeEvents.length,
        pastEvents: pastEvents.length
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setLoading(false);
    }
  };

  // FIREBASE: Create business code in Firestore
  const createBusinessCode = async () => {
    const code = newBusinessCode.trim();
    
    if (!code) {
      Alert.alert('Error', 'Please enter a business code');
      return;
    }
    
    if (businessCodes.includes(code)) {
      Alert.alert('Error', 'This business code already exists');
      return;
    }
    
    if (code.length < 3) {
      Alert.alert('Error', 'Business code must be at least 3 characters');
      return;
    }
    
    setCreatingCode(true);
    
    try {
      const updatedCodes = [...businessCodes, code];
      
      // Save to Firebase
      const businessCodesDoc = doc(db, 'admin', 'businessCodes');
      await setDoc(businessCodesDoc, { codes: updatedCodes });
      
      // Update local state
      setBusinessCodes(updatedCodes);
      
      Alert.alert('Success', `Business code "${code}" created and saved to Firebase!`);
      setNewBusinessCode('');
    } catch (error) {
      console.error('Error saving business code:', error);
      Alert.alert('Error', 'Failed to save business code to Firebase');
    } finally {
      setCreatingCode(false);
    }
  };

  // FIREBASE: Delete business code from Firestore
  const deleteBusinessCode = (code: string) => {
    Alert.alert(
      'Delete Business Code',
      `Are you sure you want to delete "${code}"?\n\nThis will prevent the business from logging in until you create the code again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            // Add to deleting set to show loading state
            setDeletingCodes(prev => new Set(prev).add(code));
            
            try {
              // FIREBASE: Delete from Firebase (we'll actually set isActive to false to keep audit trail)
              await updateDoc(doc(db, 'businessCodes', code), {
                isActive: false,
                deletedAt: serverTimestamp()
              });
              
              console.log('Business code deactivated in Firebase:', code);
              
              // Update local state
              setBusinessCodes(prev => prev.filter(c => c !== code));
              
              Alert.alert('Success', `Business code "${code}" has been deleted.`);
            } catch (error) {
              console.error('Error deleting business code:', error);
              Alert.alert('Error', 'Failed to delete business code. Please check your internet connection and try again.');
            } finally {
              // Remove from deleting set
              setDeletingCodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(code);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  const viewBusiness = async (business: Business) => {
    try {
      // Set the business code temporarily for admin access
      await AsyncStorage.setItem('businessCode', business.id);
      await AsyncStorage.setItem('isBusiness', 'true');
      await AsyncStorage.setItem('adminViewingBusiness', 'true'); // Flag for back button
      
      // Navigate to business dashboard
      router.push('/admin/dashboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to access business dashboard');
    }
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
        <LinearGradient colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.95)']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading admin panel from Firebase...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
      <LinearGradient colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.95)']} style={StyleSheet.absoluteFillObject} />
      
      <SafeAreaView style={styles.safe}>
        {/* Header - YOUR VERSION: Just logo, no title or logout */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.logoButton} onPress={() => router.push('/')}>
            <Image source={heyByronLogo} style={styles.logoImage} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* App Statistics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>App Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalBusinesses}</Text>
                <Text style={styles.statLabel}>Businesses</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.activeEvents}</Text>
                <Text style={styles.statLabel}>Active Events</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.pastEvents}</Text>
                <Text style={styles.statLabel}>Past Events</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalEvents}</Text>
                <Text style={styles.statLabel}>Total Events</Text>
              </View>
            </View>
          </View>

          {/* Business Code Management */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Business Code Management</Text>
            
            {/* Create New Code */}
            <View style={styles.createCodeSection}>
              <Text style={styles.sectionTitle}>Create New Business Code</Text>
              <View style={styles.createCodeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={newBusinessCode}
                  onChangeText={setNewBusinessCode}
                  placeholder="Enter new business code"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={[styles.createButton, creatingCode && styles.createButtonDisabled]}
                  onPress={createBusinessCode}
                  disabled={creatingCode || !newBusinessCode.trim()}
                >
                  {creatingCode ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.createButtonText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Existing Codes */}
            <View style={styles.existingCodesSection}>
              <Text style={styles.sectionTitle}>Active Business Codes ({businessCodes.length})</Text>
              {businessCodes.map((code, index) => (
                <View key={index} style={styles.codeItem}>
                  <Text style={styles.codeText}>{code}</Text>
                  <TouchableOpacity 
                    style={[
                      styles.deleteCodeButton,
                      deletingCodes.has(code) && styles.deleteCodeButtonDisabled
                    ]}
                    onPress={() => deleteBusinessCode(code)}
                    disabled={deletingCodes.has(code)}
                  >
                    {deletingCodes.has(code) ? (
                      <ActivityIndicator size="small" color="#ff6b6b" />
                    ) : (
                      <Text style={styles.deleteCodeText}>✕</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              {businessCodes.length === 0 && (
                <Text style={styles.emptyText}>No business codes created yet</Text>
              )}
            </View>
          </View>

          {/* Businesses List - YOUR VERSION: Alphabetically sorted */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registered Businesses</Text>
            {businesses.length === 0 ? (
              <Text style={styles.emptyText}>No businesses registered yet</Text>
            ) : (
              businesses
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                .map((business, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.businessItem}
                  onPress={() => viewBusiness(business)}
                >
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName}>{business.name}</Text>
                    <Text style={styles.businessDetails}>
                      {business.address} • {business.tags.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.businessActions}>
                    <Text style={styles.businessEvents}>
                      {events.filter(e => e.businessId === business.id).length} events
                    </Text>
                    <Text style={styles.viewBusinessText}>View Dashboard →</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? 16 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
  },
  logoButton: {
    padding: 8,
  },
  logoImage: {
    width: 120,
    height: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: 'rgba(194, 164, 120, 1)',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  createCodeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  createCodeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  createButton: {
    backgroundColor: 'rgba(194, 164, 120, 1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(194, 164, 120, 0.6)',
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  existingCodesSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 20,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  codeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteCodeButton: {
    backgroundColor: 'rgba(255,0,0,0.2)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  deleteCodeButtonDisabled: {
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  deleteCodeText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  businessItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  businessInfo: {
    flex: 1,
    marginRight: 12,
  },
  businessName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  businessDetails: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  businessActions: {
    alignItems: 'flex-end',
  },
  businessEvents: {
    color: 'rgba(194, 164, 120, 1)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  viewBusinessText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});