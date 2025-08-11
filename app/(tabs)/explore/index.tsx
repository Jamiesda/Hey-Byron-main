/// app/(tabs)/explore/index.tsx - Firebase Version with Distance Calculations
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Business } from '../../../data/businesses';

// NEW: Firebase imports
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

// NEW: Location imports for distance calculation
import { getCurrentLocation } from '../../../utils/locationUtils';

const backgroundPattern = require('../../../assets/background.png');

// NEW: Distance calculation helper
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// NEW: Format distance for display
const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`;
  } else {
    return `${distance.toFixed(1)}km away`;
  }
};

// NEW: Enhanced Business interface with distance
interface BusinessWithDistance extends Business {
  distance?: number;
  distanceText?: string;
}

export default function ExploreScreen() {
  const [searchText, setSearchText] = useState('');
  const [businessList, setBusinessList] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // CHANGE 1: Add error state
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // NEW: Load businesses from Firebase
  useEffect(() => {
    loadBusinesses(); // CHANGE 2: Extract to function for retry
  }, []);

  // CHANGE 3: Extract loading function for retry
  const loadBusinesses = async () => {
    try {
      setLoading(true);
      setError(false); // Reset error state
      console.log('Loading businesses from Firebase...');
      const businessesCollection = collection(db, 'businesses');
      const businessSnapshot = await getDocs(businessesCollection);
      
      const businesses: Business[] = [];
      businessSnapshot.forEach((doc) => {
        const data = doc.data();
        businesses.push({
          id: doc.id,
          name: data.name || '',
          address: data.address || '',
          description: data.description || '',
          tags: data.tags || [],
          website: data.website || '',
          socialLinks: data.socialLinks || [],
          image: data.image || undefined,
          coordinates: data.coordinates || undefined,
        });
      });
      
      console.log(`Loaded ${businesses.length} businesses from Firebase`);
      setBusinessList(businesses);
    } catch (error) {
      console.error('Error loading businesses from Firebase:', error);
      setError(true); // CHANGE 4: Set error instead of empty array
      // Keep existing businessList if this is a retry
    } finally {
      setLoading(false);
    }
  };

  // NEW: Get user location for distance calculations
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        console.log('Getting user location for distance calculations...');
        const location = await getCurrentLocation();
        if (location) {
          setUserLocation(location);
          console.log('User location obtained:', location);
        } else {
          console.log('Could not get user location');
        }
      } catch (error) {
        console.error('Error getting user location:', error);
      } finally {
        setLocationLoading(false);
      }
    };
    
    getUserLocation();
  }, []);

  // NEW: Filter and sort businesses with distance calculations
  const filteredAndSortedBusinesses = useMemo(() => {
    if (searchText.trim() === '') {
      return [];
    }

    // Filter businesses by search text
    let filtered = businessList.filter(business =>
      business.name.toLowerCase().includes(searchText.toLowerCase()) ||
      business.tags.some(tag =>
        tag.toLowerCase().includes(searchText.toLowerCase())
      )
    );

    // Calculate distances and add distance info
    const businessesWithDistance: BusinessWithDistance[] = filtered.map(business => {
      let distance: number | undefined;
      let distanceText: string | undefined;

      if (userLocation && business.coordinates) {
        distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          business.coordinates.latitude,
          business.coordinates.longitude
        );
        distanceText = formatDistance(distance);
      }

      return {
        ...business,
        distance,
        distanceText,
      };
    });

    // Sort by distance (closest first), with businesses without coordinates at the end
    businessesWithDistance.sort((a, b) => {
      if (a.distance === undefined && b.distance === undefined) return 0;
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });

    return businessesWithDistance;
  }, [searchText, businessList, userLocation]);

  const renderItem = ({ item }: { item: BusinessWithDistance }) => (
    <Link href={{ pathname: '/explore/[id]', params: { id: item.id } }} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.8}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
            <Ionicons name="business-outline" size={24} color="#999" />
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {/* NEW: Distance indicator */}
            {item.distanceText && (
              <Text style={styles.distance}>{item.distanceText}</Text>
            )}
          </View>
          <Text style={styles.tags} numberOfLines={2}>{item.tags.join(' • ')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.6)" />
      </TouchableOpacity>
    </Link>
  );

  const renderEmptyState = () => {
    // CHANGE 5: Add error state handling
    if (error && !loading) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBusinesses}>
            <Ionicons name="refresh-outline" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="rgba(194, 164, 120, 1)" />
          <Text style={styles.emptyTitle}>Loading businesses...</Text>
        </View>
      );
    }

    if (searchText.trim() === '') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="rgba(0,0,0,0.3)" />
          <Text style={styles.emptyTitle}>Discover Byron Bay</Text>
          <Text style={styles.emptySubtitle}>Search for businesses, cafes, restaurants, and more...</Text>
          {locationLoading && (
            <Text style={styles.locationText}>📍 Getting your location for distance calculations...</Text>
          )}
          {!locationLoading && !userLocation && (
            <Text style={styles.locationText}>📍 Enable location for distance info</Text>
          )}
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name="sad-outline" size={64} color="rgba(0,0,0,0.3)" />
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>Try adjusting your search terms</Text>
      </View>
    );
  };

  const renderResultsHeader = () => {
    if (filteredAndSortedBusinesses.length === 0 || searchText.trim() === '') {
      return null;
    }

    const sortText = userLocation ? ' • Sorted by distance' : '';

    return (
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredAndSortedBusinesses.length} result{filteredAndSortedBusinesses.length !== 1 ? 's' : ''} found{sortText}
        </Text>
      </View>
    );
  };

  return (
    <ImageBackground 
      source={backgroundPattern} 
      style={styles.background}
      resizeMode="repeat"
    >
      <LinearGradient 
        colors={['rgba(255, 255, 255, 0.96)', 'rgb(30, 120, 120)']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safe}>        
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(0,0,0,0.6)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search businesses near you..."
              placeholderTextColor="rgba(0,0,0,0.6)"
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>
        
        {renderResultsHeader()}
        
        <FlatList
          data={filteredAndSortedBusinesses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
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
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 40,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.09)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  searchIcon: {
    marginRight: 8,
    color: 'rgba(0,0,0,0.6)',
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: 'rgba(0,0,0,0.8)',
    fontWeight: '400',
    height: '100%',
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  // NEW: Location status indicator
  locationStatus: {
    fontSize: 12,
    color: 'rgba(194, 164, 120, 1)',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  list: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 16,
  },
  placeholderThumbnail: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingRight: 12,
  },
  // NEW: Name row to accommodate distance
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.8)',
    flex: 1,
    marginRight: 8,
  },
  // NEW: Distance styling
  distance: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(194, 164, 120, 1)', // Gold accent color
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tags: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.8)',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  // NEW: Location text styling
  locationText: {
    fontSize: 14,
    color: 'rgba(194, 164, 120, 1)',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  // CHANGE 6: Add retry button styles (only addition to styles)
  retryButton: {
    backgroundColor: 'rgba(194, 164, 120, 1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});