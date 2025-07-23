// app/explore/[id].tsx - Firebase Version
// @ts-nocheck

import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageBackground,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Business } from '../../data/businesses';

// NEW: Firebase imports
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const backgroundPattern = require('../../assets/background.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Dark teal gradient to match the feed
const GRADIENT_COLORS = [
  'rgb(16, 78, 78)', 
  'rgb(30, 120, 120)'
] as const;

export default function BusinessDetail() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const businessId = rawId ?? '';
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));

  // UPDATED: Load business from Firebase instead of AsyncStorage
  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    
    const loadBusinessFromFirebase = async () => {
      try {
        console.log('Loading business detail from Firebase:', businessId);
        const businessDoc = doc(db, 'businesses', businessId);
        const businessSnap = await getDoc(businessDoc);
        
        if (businessSnap.exists()) {
          const data = businessSnap.data();
          const businessData: Business = {
            id: businessSnap.id,
            name: data.name || '',
            address: data.address || '',
            description: data.description || '',
            tags: data.tags || [],
            website: data.website || '',
            socialLinks: data.socialLinks || [],
            image: data.image || undefined,
            coordinates: data.coordinates || undefined,
          };
          
          setBusiness(businessData);
          console.log('Business detail loaded from Firebase:', businessData.name);
        } else {
          console.log('No business found in Firebase for ID:', businessId);
          setBusiness(null);
        }
      } catch (error) {
        console.error('Error loading business detail from Firebase:', error);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadBusinessFromFirebase();
  }, [businessId]);

  const openMap = () => {
    if (!business?.address) return;
    const q = encodeURIComponent(business.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  const handleViewEvents = () => {
    router.push(`/(tabs)?businessId=${businessId}`);
  };

  const openWebsite = () => {
    if (!business?.website) return;
    let url = business.website;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    Linking.openURL(url);
  };

  const openSocialLink = (url: string) => {
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = `https://${url}`;
    }
    Linking.openURL(formattedUrl);
  };

  const getSocialIcon = (url: string): string => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('youtube.com')) return 'youtube-play';
    if (lowerUrl.includes('tiktok.com')) return 'music'; // Closest icon for TikTok
    return 'link';
  };

  // Header animation based on scroll
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 200],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: [1.2, 1, 0.8],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, 200, 300],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  // UPDATED: Show loading or error states
  if (loading) {
    return (
      <ImageBackground 
        source={backgroundPattern} 
        style={styles.background}
        resizeMode="repeat"
      >
        <LinearGradient 
          colors={GRADIENT_COLORS}
          style={StyleSheet.absoluteFillObject}
        />
        
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <Ionicons name="business-outline" size={64} color="rgba(194, 164, 120, 0.5)" />
            <Text style={styles.loadingText}>Loading from cloud...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (!business) {
    return (
      <ImageBackground 
        source={backgroundPattern} 
        style={styles.background}
        resizeMode="repeat"
      >
        <LinearGradient 
          colors={GRADIENT_COLORS}
          style={StyleSheet.absoluteFillObject}
        />
        
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <Ionicons name="sad-outline" size={64} color="rgba(194, 164, 120, 0.5)" />
            <Text style={styles.loadingText}>Business not found</Text>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={backgroundPattern} 
        style={styles.background}
        resizeMode="repeat"
      >
        <LinearGradient 
          colors={GRADIENT_COLORS}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Hero Image Section */}
        {business.image && (
          <Animated.View style={[styles.heroContainer, { opacity: imageOpacity }]}>
            <Animated.Image
              source={{ uri: business.image }}
              style={[
                styles.heroImage,
                {
                  transform: [{ scale: imageScale }]
                }
              ]}
              resizeMode="cover"
            />
            {/* Gradient overlay for better text readability */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.heroGradient}
            />
          </Animated.View>
        )}

        {/* Animated Header */}
        <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
          <LinearGradient 
            colors={['rgba(16, 78, 78, 0.95)', 'rgba(30, 120, 120, 0.95)']}
            style={styles.headerGradient}
          />
          <SafeAreaView style={styles.headerContent}>
            <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{business.name}</Text>
          </SafeAreaView>
        </Animated.View>

        <SafeAreaView style={styles.safe}>
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={business?.image ? styles.scrollContent : styles.scrollContentNoImage}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Content */}
            <View style={styles.contentContainer}>
              {/* Business Name Card */}
              <View style={styles.nameCard}>
                <Text style={styles.businessName}>{business.name}</Text>
                {business.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {business.tags.slice(0, 3).map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                    {business.tags.length > 3 && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>+{business.tags.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Quick Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.primaryAction} onPress={handleViewEvents}>
                  <LinearGradient
                    colors={['rgba(194, 164, 120, 1)', 'rgba(174, 144, 100, 1)']}
                    style={styles.actionGradient}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#000" />
                    <Text style={styles.primaryActionText}>View Events</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {business.address && (
                  <TouchableOpacity style={styles.secondaryAction} onPress={openMap}>
                    <Ionicons name="location-outline" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.secondaryActionText}>Directions</Text>
                  </TouchableOpacity>
                )}

                {business.website && (
                  <TouchableOpacity style={styles.secondaryAction} onPress={openWebsite}>
                    <Ionicons name="globe-outline" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.secondaryActionText}>Website</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Address Card */}
              {business.address && (
                <TouchableOpacity style={styles.infoCard} onPress={openMap} activeOpacity={0.7}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="location" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.cardTitle}>Location</Text>
                  </View>
                  <Text style={styles.addressText}>{business.address}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Tap for directions</Text>
                    <Ionicons name="arrow-forward" size={16} color="rgba(194, 164, 120, 0.7)" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Description Card */}
              {business.description && (
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="information-circle" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.cardTitle}>About</Text>
                  </View>
                  <Text style={styles.descriptionText}>{business.description}</Text>
                </View>
              )}

              {/* Social Media Card */}
              {business.socialLinks?.length ? (
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="share-social" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.cardTitle}>Connect</Text>
                  </View>
                  <View style={styles.socialContainer}>
                    {business.socialLinks.map((url, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.socialButton}
                        onPress={() => openSocialLink(url)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome 
                          name={getSocialIcon(url)} 
                          size={24} 
                          color="rgba(194, 164, 120, 1)" 
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Contact Card */}
              {business.website && (
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="globe" size={20} color="rgba(194, 164, 120, 1)" />
                    <Text style={styles.cardTitle}>Website</Text>
                  </View>
                  <TouchableOpacity onPress={openWebsite}>
                    <Text style={styles.websiteText}>{business.website}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom Spacing */}
            <View style={styles.bottomSpacing} />
          </Animated.ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

BusinessDetail.options = {
  headerShown: false,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  // NEW: Back button for error state
  backButton: {
    marginTop: 20,
    backgroundColor: 'rgba(194, 164, 120, 1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
    zIndex: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SCREEN_HEIGHT * 0.35,
  },
  scrollContentNoImage: {
    paddingTop: 100,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  nameCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  businessName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(194, 164, 120, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(194, 164, 120, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(194, 164, 120, 1)',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryAction: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
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
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(194, 164, 120, 0.3)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(194, 164, 120, 1)',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addressText: {
    fontSize: 16,
    color: '#4a4a4a',
    lineHeight: 22,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#4a4a4a',
    lineHeight: 24,
  },
  websiteText: {
    fontSize: 16,
    color: 'rgba(194, 164, 120, 1)',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(194, 164, 120, 0.8)',
    fontWeight: '500',
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  socialButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(194, 164, 120, 0.1)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(194, 164, 120, 0.2)',
  },
  bottomSpacing: {
    height: 40,
  },
});