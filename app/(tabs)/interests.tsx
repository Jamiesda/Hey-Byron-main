// app/(tabs)/interests.tsx - Enhanced with Location Toggle and Map
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  ImageBackground,
  Platform,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { INTEREST_OPTIONS } from '../../data/interests';
import { Coordinates, getCachedUserLocation, initializeLocationServices } from '../../utils/locationUtils';

const backgroundPattern = require('../../assets/background.png');
const { width, height } = Dimensions.get('window');

// Pre-calculate distance values to avoid runtime calculations (1km increments)
const DISTANCE_VALUES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
] as const;

// DEFAULT DISTANCE INDEX - Explicitly set to 1 (which corresponds to 1km)
const DEFAULT_DISTANCE_INDEX = 1; // 1km

// UPDATED GRADIENT COLORS - Teal/dark green gradient like ChatGPT
const GRADIENT_COLORS = [
  'rgb(16, 78, 78)', 
  'rgb(30, 120, 120)'
] as const;

// Memoized slider labels (prevent recreation on each render)
const SLIDER_LABELS = ['Any', '3km', '6km', '9km', '12km', '15km'] as const;

// Default Byron Bay coordinates as fallback
const BYRON_BAY_COORDS: Coordinates = {
  latitude: -28.6474,
  longitude: 153.6020
};

export default function InterestsScreen() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  // EXPLICITLY DEFAULT TO 1KM (index 1)
  const [selectedDistanceIndex, setSelectedDistanceIndex] = useState<number>(DEFAULT_DISTANCE_INDEX);
  
  // NEW MAP FUNCTIONALITY STATES - Default location OFF
  const [locationFilterEnabled, setLocationFilterEnabled] = useState(false);
  const [mapCenter, setMapCenter] = useState<Coordinates>(BYRON_BAY_COORDS);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Memoized handlers to prevent recreation
  const navigateHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  // NEW LOCATION TOGGLE HANDLER WITH SHOW/HIDE LOGIC
  const toggleLocationFilter = useCallback(async (enabled: boolean) => {
    console.log('Toggle location filter:', enabled);
    
    setLocationFilterEnabled(enabled);
    
    if (enabled) {
      // Turn ON: Show map immediately
      setShowMap(true);
      
      // Initialize location services and get user location
      await initializeLocationServices();
      const location = await getCachedUserLocation();
      
      if (location) {
        setUserLocation(location);
        setMapCenter(location);
      } else {
        // Fallback to Byron Bay if location unavailable
        setMapCenter(BYRON_BAY_COORDS);
      }
    } else {
      // Turn OFF: Hide map
      setShowMap(false);
    }
    
    // Save preference
    try {
      await AsyncStorage.setItem('locationFilterEnabled', JSON.stringify(enabled));
    } catch (error) {
      console.error('Error saving location filter preference:', error);
    }
  }, []);

  // NEW SET BUTTON HANDLER
  const handleSetLocation = useCallback(async () => {
    console.log('Set location button pressed');
    
    // Hide map, show interests again, but keep location filtering active
    setShowMap(false);
    
    // Save the map center
    try {
      await AsyncStorage.setItem('mapCenter', JSON.stringify(mapCenter));
    } catch (error) {
      console.error('Error saving map center:', error);
    }
    
    console.log('Location set, map hidden, interests should now be visible');
  }, [mapCenter]);

  // Handle map region change
  const onMapRegionChange = useCallback((region: any) => {
    setMapCenter({
      latitude: region.latitude,
      longitude: region.longitude
    });
  }, []);

  // Optimized interest toggle with useCallback
  const toggleInterest = useCallback((interest: string) => {
    setSelectedInterests(prev => {
      const isSelected = prev.includes(interest);
      if (isSelected) {
        return prev.filter(i => i !== interest);
      } else {
        return [...prev, interest];
      }
    });
  }, []);

  // Optimized select all toggle
  const toggleSelectAll = useCallback(() => {
    setSelectedInterests(prev => {
      if (prev.length === INTEREST_OPTIONS.length) {
        return []; // Deselect all
      } else {
        return [...INTEREST_OPTIONS]; // Select all
      }
    });
  }, []);

  // Optimized distance change handler
  const handleDistanceChange = useCallback((index: number) => {
    setSelectedDistanceIndex(Math.round(index));
  }, []);

  // Memoized distance label to prevent recalculation
  const distanceLabel = useMemo(() => {
    const distance = DISTANCE_VALUES[selectedDistanceIndex];
    return distance === 0 ? 'Any Distance' : `${distance}km`;
  }, [selectedDistanceIndex]);

  // Memoized select all button text
  const selectAllText = useMemo(() => {
    return selectedInterests.length === INTEREST_OPTIONS.length 
      ? 'Deselect All' 
      : 'Select All';
  }, [selectedInterests.length]);

  // Calculate radius in meters for map circle
  const radiusInMeters = useMemo(() => {
    const distance = DISTANCE_VALUES[selectedDistanceIndex];
    return distance * 1000; // Convert km to meters
  }, [selectedDistanceIndex]);

  // DETERMINE WHAT TO SHOW BASED ON STATE
  const shouldShowInterests = useMemo(() => {
    // Show interests when location is OFF OR when location is ON but map is hidden
    return !locationFilterEnabled || !showMap;
  }, [locationFilterEnabled, showMap]);

  const shouldShowMap = useMemo(() => {
    // Show map only when location is ON AND showMap is true
    return locationFilterEnabled && showMap;
  }, [locationFilterEnabled, showMap]);

  // Load preferences on mount with explicit 1km default
  useEffect(() => {
    let isMounted = true;
    
    const loadPreferences = async () => {
      try {
        const [rawInterests, rawDistance, rawLocationFilter] = await Promise.all([
          AsyncStorage.getItem('userInterests'),
          AsyncStorage.getItem('userDistance'),
          AsyncStorage.getItem('locationFilterEnabled')
        ]);
        
        if (!isMounted) return; // Component unmounted, don't update state
        
        if (rawInterests) {
          const interests = JSON.parse(rawInterests);
          setSelectedInterests(Array.isArray(interests) ? interests : []);
        }
        
        if (rawDistance) {
          const distance = JSON.parse(rawDistance);
          const index = DISTANCE_VALUES.indexOf(distance);
          // ALWAYS DEFAULT TO 1KM if saved distance is not found or is 0
          setSelectedDistanceIndex(index > 0 ? index : DEFAULT_DISTANCE_INDEX);
        } else {
          // ALWAYS default to 1km on first load
          setSelectedDistanceIndex(DEFAULT_DISTANCE_INDEX);
        }
        
        // Location filter always resets to OFF on startup
        setLocationFilterEnabled(false);
        setShowMap(false);
        
        // Initialize location services in background
        await initializeLocationServices();
        const location = await getCachedUserLocation();
        if (location) {
          setUserLocation(location);
          if (!rawLocationFilter || !JSON.parse(rawLocationFilter)) {
            setMapCenter(location);
          }
        }
        
        console.log(`Distance defaulted to: ${DISTANCE_VALUES[DEFAULT_DISTANCE_INDEX]}km`);
      } catch (error) {
        console.error('Error loading preferences:', error);
        // On error, ensure we still default to 1km
        setSelectedDistanceIndex(DEFAULT_DISTANCE_INDEX);
      }
    };
    
    loadPreferences();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Optimized persistence with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      AsyncStorage.setItem('userInterests', JSON.stringify(selectedInterests));
    }, 100); // Small debounce to avoid excessive writes
    
    return () => clearTimeout(timeoutId);
  }, [selectedInterests]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const selectedDistance = DISTANCE_VALUES[selectedDistanceIndex];
      AsyncStorage.setItem('userDistance', JSON.stringify(selectedDistance));
      console.log(`Distance saved: ${selectedDistance}km`);
    }, 100); // Small debounce
    
    return () => clearTimeout(timeoutId);
  }, [selectedDistanceIndex]);

  // Save map center when location filter is enabled
  useEffect(() => {
    if (locationFilterEnabled && mapCenter) {
      const timeoutId = setTimeout(() => {
        AsyncStorage.setItem('mapCenter', JSON.stringify(mapCenter));
      }, 500); // Debounce map movements
      
      return () => clearTimeout(timeoutId);
    }
  }, [mapCenter, locationFilterEnabled]);

  // Memoized continue handler
  const onContinue = useCallback(() => {
    if (!selectedInterests.length) {
      Alert.alert(
        'Select Interests', 
        'Please select at least one interest to personalize your experience.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    navigateHome();
  }, [selectedInterests.length, navigateHome]);

  // Optimized render item with proper memoization
  const renderInterestItem = useCallback(({ item }: { item: string }) => {
    const isSelected = selectedInterests.includes(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.interestCard,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => toggleInterest(item)}
        activeOpacity={0.8}
        accessibilityLabel={`${item} interest`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[
            styles.interestText,
            isSelected && styles.selectedText,
          ]}
          numberOfLines={2}
        >
          {item}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={18} color="#000" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedInterests, toggleInterest]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: string) => item, []);

  // Memoized item separator
  const ItemSeparator = useCallback(() => <View style={styles.itemSeparator} />, []);

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
        {/* ALWAYS show subtitle at top for fluid appearance */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            {shouldShowMap 
              ? "Move the map and adjust distance, then tap Set" 
              : "Choose your interests to discover personalized events"
            }
          </Text>
        </View>

        <View style={styles.controlsContainer}>
          {/* Location Toggle - moved to left position */}
          <View style={styles.locationToggleContainer}>
            <Ionicons 
              name={locationFilterEnabled ? "location" : "location-outline"} 
              size={16} 
              color="#fff" 
              style={styles.locationToggleIcon} 
            />
            <Text style={styles.locationToggleText}>Location</Text>
            <Switch
              value={locationFilterEnabled}
              onValueChange={toggleLocationFilter}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(194, 164, 120, 0.8)' }}
              thumbColor={locationFilterEnabled ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="rgba(0,0,0,0.1)"
              style={styles.locationSwitch}
            />
          </View>

          {/* Show set button in place of select all when map is showing - moved to right position */}
          {shouldShowMap ? (
            <TouchableOpacity 
              style={styles.selectAllButton} 
              onPress={handleSetLocation}
              accessibilityLabel="Set location and distance"
            >
              <Text style={styles.selectAllText}>Set</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.selectAllButton} 
              onPress={toggleSelectAll}
              accessibilityLabel={selectAllText}
            >
              <Text style={styles.selectAllText}>{selectAllText}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* MAP SECTION - only show when shouldShowMap is true */}
        {shouldShowMap && (
          <View style={styles.mapSection}>
            <View style={styles.distanceValueContainer}>
              <Text style={styles.distanceValue}>{distanceLabel}</Text>
            </View>

            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={DISTANCE_VALUES.length - 1}
                step={1}
                value={selectedDistanceIndex}
                onValueChange={handleDistanceChange}
                minimumTrackTintColor="rgba(194, 164, 120, 0.8)"
                maximumTrackTintColor="rgba(0,0,0,0.2)"
                thumbStyle={styles.sliderThumb}
                trackStyle={styles.sliderTrack}
                accessibilityLabel="Distance slider"
              />
              
              <View style={styles.sliderLabels}>
                {SLIDER_LABELS.map((label, index) => (
                  <Text key={index} style={styles.sliderLabel}>
                    {label}
                  </Text>
                ))}
              </View>
            </View>

            {/* Interactive Map */}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: mapCenter.latitude,
                  longitude: mapCenter.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onRegionChange={onMapRegionChange}
                showsUserLocation={true}
                showsMyLocationButton={true}
                showsCompass={true}
                toolbarEnabled={false}
              >
                {/* Center marker */}
                <Marker
                  coordinate={mapCenter}
                  title="Search Center"
                  description="Events will be filtered around this location"
                >
                  <View style={styles.centerMarker}                  >
                    <Ionicons name="location" size={24} color="rgba(194, 164, 120, 1)" />
                  </View>
                </Marker>

                {/* Radius circle (only show if distance is set) */}
                {selectedDistanceIndex > 0 && (
                  <Circle
                    center={mapCenter}
                    radius={radiusInMeters}
                    strokeColor="rgba(194, 164, 120, 0.8)"
                    fillColor="rgba(194, 164, 120, 0.2)"
                    strokeWidth={2}
                  />
                )}

                {/* User location marker (if different from center) */}
                {userLocation && 
                 (Math.abs(userLocation.latitude - mapCenter.latitude) > 0.001 ||
                  Math.abs(userLocation.longitude - mapCenter.longitude) > 0.001) && (
                  <Marker
                    coordinate={userLocation}
                    title="Your Location"
                    description="Your current location"
                  >
                    <View style={styles.userLocationMarker}>
                      <Ionicons name="person" size={16} color="#fff" />
                    </View>
                  </Marker>
                )}
              </MapView>
              
              <View style={styles.mapInstructions}>
                <Text style={styles.mapInstructionsText}>
                  Drag the map to set your search center
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* INTERESTS SECTION - only show when shouldShowInterests is true */}
        {shouldShowInterests && (
          <FlatList
            data={INTEREST_OPTIONS}
            keyExtractor={keyExtractor}
            numColumns={2}
            contentContainerStyle={styles.list}
            renderItem={renderInterestItem}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={ItemSeparator}
            removeClippedSubviews={true} // Performance optimization
            maxToRenderPerBatch={10} // Render in smaller batches
            windowSize={21} // Optimize memory usage
            getItemLayout={undefined} // Let FlatList handle dynamic sizing
            initialNumToRender={10} // Start with fewer items
          />
        )}

        {/* FOOTER - only show when interests are visible */}
        {shouldShowInterests && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[
                styles.continueButton,
                !selectedInterests.length && styles.disabledButton
              ]} 
              onPress={onContinue}
              disabled={!selectedInterests.length}
              accessibilityLabel="Continue to events"
              accessibilityState={{ disabled: !selectedInterests.length }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={!selectedInterests.length ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.2)'] : ['#c2a478', '#a08960']}
                style={styles.buttonGradient}
              >
                <Text style={[
                  styles.continueText,
                  !selectedInterests.length && styles.disabledText
                ]}>
                  Continue
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

InterestsScreen.options = { headerShown: false };

// Enhanced styles - Updated for light gradient with sand colors preserved
const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingHorizontal: 20,
  },
  subtitleContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)', // Light text for dark background
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  selectAllButton: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Light button for dark background
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectAllText: {
    fontSize: 12,
    color: '#fff', // White text for dark background
    fontWeight: '600',
  },
  locationToggleContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Light button for dark background
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationToggleIcon: {
    marginRight: 4,
  },
  locationToggleText: {
    fontSize: 12,
    color: '#fff', // White text for dark background
    fontWeight: '600',
    marginRight: 6,
  },
  locationSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  setLocationButton: {
    backgroundColor: '#D2B48C', // SAND COLOR PRESERVED
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  setLocationButtonText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '700',
  },
  mapSection: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 15, // Reduced padding to maximize map space
    marginHorizontal: -20, // Extend to full screen edges
    marginBottom: 0, // Stop at tab bar, don't extend underneath
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    flex: 1, // Take up remaining space to bottom
    paddingBottom: 15, // Add some padding above tab bar
  },
  distanceValueContainer: {
    alignItems: 'center',
    marginBottom: 8, // Reduced from 15
  },
  distanceValue: {
    fontSize: 18,
    color: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    fontWeight: '700',
    textAlign: 'center',
  },
  sliderContainer: {
    paddingHorizontal: 10,
    marginBottom: 12, // Reduced from 20
  },
  slider: {
    width: '100%',
    height: 30, // Reduced from 40 to make it thinner
  },
  sliderThumb: {
    backgroundColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sliderTrack: {
    height: 4, // Reduced from 6
    borderRadius: 2, // Adjusted for new height
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2, // Reduced from 5
    paddingHorizontal: 5,
  },
  sliderLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)', // Light text for dark background
    fontWeight: '500',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    flex: 1, // Take remaining space in mapSection
  },
  map: {
    width: '100%',
    flex: 1, // Take up all available space in the container
    minHeight: 300, // Minimum height to ensure map is usable
  },
  mapInstructions: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  mapInstructionsText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  centerMarker: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userLocationMarker: {
    backgroundColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  list: {
    paddingBottom: 20,
  },
  itemSeparator: {
    height: 8,
  },
  interestCard: {
    flex: 1,
    margin: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    position: 'relative',
    // Optimized shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(194, 164, 120, 0.8)', // Gold/tan accent color
    borderWidth: 2,
    // Enhanced shadows for selected state
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  interestText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
  selectedText: {
    color: '#333', // Keep text black when selected
    fontWeight: '700',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  disabledButton: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  disabledText: {
    color: 'rgba(255,255,255,0.5)',
  },
});