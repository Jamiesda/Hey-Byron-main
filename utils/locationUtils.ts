// utils/locationUtils.ts - Enhanced with Map-based Filtering

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocacheItem {
  address: string;
  coordinates: Coordinates;
  timestamp: number;
}

export interface BusinessDistanceCache {
  businessId: string;
  distance: number;
  timestamp: number;
  centerLat: number;
  centerLon: number;
}

// Cache durations
const GEOCACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const DISTANCE_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours for distance calculations
const USER_LOCATION_DURATION = 2 * 60 * 60 * 1000; // 2 hours for user location

// Cache keys
const GEOCACHE_KEY = 'geocodingCache';
const USER_LOCATION_KEY = 'userLocationCache';
const DISTANCE_CACHE_KEY = 'businessDistanceCache';
const MAP_CENTER_KEY = 'mapCenter';
const LOCATION_FILTER_KEY = 'locationFilterEnabled';

// Rough distance estimation (faster than Haversine for filtering)
const APPROX_KM_PER_DEGREE = 111; // Rough approximation

/**
 * Fast approximate distance calculation (much faster than Haversine)
 * Good enough for filtering - uses simple coordinate differences
 */
const calculateApproximateDistance = (
  coord1: Coordinates,
  coord2: Coordinates
): number => {
  const latDiff = Math.abs(coord2.latitude - coord1.latitude);
  const lonDiff = Math.abs(coord2.longitude - coord1.longitude);
  
  // Simple Euclidean distance approximation
  const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * APPROX_KM_PER_DEGREE;
  return distance;
};

/**
 * Precise Haversine calculation (only used when we need accuracy)
 */
const calculatePreciseDistance = (
  coord1: Coordinates,
  coord2: Coordinates
): number => {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * Get cached user location
 */
export const getCachedUserLocation = async (): Promise<Coordinates | null> => {
  try {
    const cached = await AsyncStorage.getItem(USER_LOCATION_KEY);
    if (!cached) return null;
    
    const { coordinates, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    if (now - timestamp < USER_LOCATION_DURATION) {
      return coordinates;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Cache user location
 */
export const cacheUserLocation = async (coordinates: Coordinates): Promise<void> => {
  try {
    const locationData = { coordinates, timestamp: Date.now() };
    await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify(locationData));
  } catch (error) {
    // Silently fail - not critical
  }
};

/**
 * Get cached map center (for location filter)
 */
export const getCachedMapCenter = async (): Promise<Coordinates | null> => {
  try {
    const cached = await AsyncStorage.getItem(MAP_CENTER_KEY);
    if (!cached) return null;
    
    return JSON.parse(cached);
  } catch (error) {
    return null;
  }
};

/**
 * Cache map center
 */
export const cacheMapCenter = async (coordinates: Coordinates): Promise<void> => {
  try {
    await AsyncStorage.setItem(MAP_CENTER_KEY, JSON.stringify(coordinates));
  } catch (error) {
    // Silently fail - not critical
  }
};

/**
 * Get location filter enabled state
 */
export const getLocationFilterEnabled = async (): Promise<boolean> => {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_FILTER_KEY);
    if (!cached) return false;
    
    return JSON.parse(cached);
  } catch (error) {
    return false;
  }
};

/**
 * Set location filter enabled state
 */
export const setLocationFilterEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCATION_FILTER_KEY, JSON.stringify(enabled));
  } catch (error) {
    // Silently fail - not critical
  }
};

/**
 * Load distance cache for businesses (enhanced for map center)
 */
const loadDistanceCache = async (centerLocation: Coordinates): Promise<Map<string, number>> => {
  try {
    const cached = await AsyncStorage.getItem(DISTANCE_CACHE_KEY);
    if (!cached) return new Map();
    
    const cache: BusinessDistanceCache[] = JSON.parse(cached);
    const now = Date.now();
    
    // Find cache entries that are close to the current center location
    const validCache = cache.filter(item => {
      if (now - item.timestamp > DISTANCE_CACHE_DURATION) return false;
      
      // Check if cached center is close to current center (within ~500m)
      const centerDistance = calculateApproximateDistance(
        { latitude: item.centerLat, longitude: item.centerLon },
        centerLocation
      );
      
      return centerDistance < 0.5; // Within 500m of cached center
    });
    
    const cacheMap = new Map<string, number>();
    validCache.forEach(item => {
      cacheMap.set(item.businessId, item.distance);
    });
    
    return cacheMap;
  } catch (error) {
    return new Map();
  }
};

/**
 * Save distance calculations to cache (enhanced for map center)
 */
const saveDistanceCache = async (
  centerLocation: Coordinates, 
  businessDistances: Map<string, number>
): Promise<void> => {
  try {
    const cacheEntries: BusinessDistanceCache[] = [];
    
    businessDistances.forEach((distance, businessId) => {
      cacheEntries.push({
        businessId,
        distance,
        timestamp: Date.now(),
        centerLat: centerLocation.latitude,
        centerLon: centerLocation.longitude
      });
    });
    
    // Keep only recent entries (max 1000 to prevent bloat)
    const existing = await AsyncStorage.getItem(DISTANCE_CACHE_KEY);
    const existingCache: BusinessDistanceCache[] = existing ? JSON.parse(existing) : [];
    const allEntries = [...existingCache, ...cacheEntries];
    
    // Sort by timestamp and keep most recent
    const sortedEntries = allEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 1000);
    
    await AsyncStorage.setItem(DISTANCE_CACHE_KEY, JSON.stringify(sortedEntries));
  } catch (error) {
    // Silently fail - not critical
  }
};

/**
 * Background location initialization (non-blocking)
 */
export const initializeLocationServices = async (): Promise<void> => {
  try {
    const cached = await getCachedUserLocation();
    if (cached) return; // Already have recent location
    
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    if (existingStatus !== 'granted') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
    }
    
    const isLocationEnabled = await Location.hasServicesEnabledAsync();
    if (!isLocationEnabled) return;
    
    // Quick location fetch with timeout
    setTimeout(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Better accuracy for map use
        });
        
        await cacheUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        // Try last known location
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            await cacheUserLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
          }
        } catch (fallbackError) {
          // Silently fail
        }
      }
    }, 100); // Small delay to not block UI
  } catch (error) {
    // Silently fail
  }
};

/**
 * Get current location with permission handling
 */
export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  try {
    // Check cached location first
    const cached = await getCachedUserLocation();
    if (cached) return cached;
    
    // Request permissions
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    if (existingStatus !== 'granted') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
    }
    
    const isLocationEnabled = await Location.hasServicesEnabledAsync();
    if (!isLocationEnabled) return null;
    
    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    const coordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
    // Cache the location
    await cacheUserLocation(coordinates);
    
    return coordinates;
  } catch (error) {
    // Try last known location as fallback
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coordinates = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        await cacheUserLocation(coordinates);
        return coordinates;
      }
    } catch (fallbackError) {
      // Return null if all attempts fail
    }
    
    return null;
  }
};

/**
 * Lightweight geocoding with aggressive caching
 */
const geocodeAddressOptimized = async (address: string): Promise<Coordinates | null> => {
  if (!address?.trim()) return null;
  
  // Normalize address more aggressively to improve cache hits
  const normalizedAddress = address.trim().toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/,\s*/g, ','); // Normalize commas
  
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(GEOCACHE_KEY);
    if (cached) {
      const cache: GeocacheItem[] = JSON.parse(cached);
      const now = Date.now();
      
      const validCached = cache.find(item => 
        item.address === normalizedAddress && 
        now - item.timestamp < GEOCACHE_DURATION
      );
      
      if (validCached) return validCached.coordinates;
    }
    
    // If not cached, geocode with timeout
    const geocoded = await Promise.race([
      Location.geocodeAsync(address),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
      )
    ]);
    
    if (geocoded && geocoded.length > 0) {
      const coordinates: Coordinates = {
        latitude: geocoded[0].latitude,
        longitude: geocoded[0].longitude,
      };
      
      // Save to cache (fire and forget)
      setTimeout(async () => {
        try {
          const cache: GeocacheItem[] = cached ? JSON.parse(cached) : [];
          const newEntry: GeocacheItem = {
            address: normalizedAddress,
            coordinates,
            timestamp: Date.now(),
          };
          
          // Keep only 300 most recent entries
          const limitedCache = [...cache.filter(item => item.address !== normalizedAddress), newEntry]
            .slice(-300);
          
          await AsyncStorage.setItem(GEOCACHE_KEY, JSON.stringify(limitedCache));
        } catch (error) {
          // Silently fail
        }
      }, 0);
      
      return coordinates;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * ENHANCED: Filter events by distance with map center support
 * Now supports both user location and custom map center
 * FIXED: Properly handles distance = 0 case (any distance)
 */
export const filterEventsByDistance = async (
  events: any[],
  businesses: any[],
  maxDistance: number | null,
  centerLocation?: Coordinates | null // Allow null as well as undefined
): Promise<any[]> => {
  // FIXED: If maxDistance is 0 or null, return all events (no filtering)
  if (!maxDistance || maxDistance === 0) return events;
  
  // Use provided center location or fall back to user location
  let searchCenter = centerLocation;
  if (!searchCenter) {
    searchCenter = await getCachedUserLocation();
    if (!searchCenter) return events;
  }
  
  // Load distance cache for this center
  const distanceCache = await loadDistanceCache(searchCenter);
  const newDistances = new Map<string, number>();
  
  // Pre-filter: Quick elimination using bounding box
  const degreeRadius = maxDistance / APPROX_KM_PER_DEGREE;
  const boundingBox = {
    minLat: searchCenter.latitude - degreeRadius,
    maxLat: searchCenter.latitude + degreeRadius,
    minLon: searchCenter.longitude - degreeRadius,
    maxLon: searchCenter.longitude + degreeRadius,
  };
  
  // Create business coordinates map (only for events we need)
  const relevantBusinessIds = new Set(events.map(event => event.businessId));
  const businessCoords = new Map<string, Coordinates>();
  
  // Process businesses in smaller batches to avoid blocking
  const businessBatches = Array.from(relevantBusinessIds).reduce((batches: string[][], id, index) => {
    const batchIndex = Math.floor(index / 10); // Process 10 at a time
    if (!batches[batchIndex]) batches[batchIndex] = [];
    batches[batchIndex].push(id);
    return batches;
  }, []);
  
  for (const batch of businessBatches) {
    await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI thread
    
    for (const businessId of batch) {
      // Check distance cache first
      if (distanceCache.has(businessId)) {
        const cachedDistance = distanceCache.get(businessId)!;
        if (cachedDistance <= maxDistance) {
          // Don't need coordinates, just know it's within range
          businessCoords.set(businessId, { latitude: 0, longitude: 0 }); // Placeholder
        }
        continue;
      }
      
      const business = businesses.find(b => b.id === businessId);
      if (!business?.address) continue;
      
      const coordinates = await geocodeAddressOptimized(business.address);
      if (!coordinates) continue;
      
      // Quick bounding box check first
      if (coordinates.latitude < boundingBox.minLat || 
          coordinates.latitude > boundingBox.maxLat ||
          coordinates.longitude < boundingBox.minLon || 
          coordinates.longitude > boundingBox.maxLon) {
        continue; // Outside bounding box, skip expensive calculation
      }
      
      // Use precise distance calculation for map-based filtering (more accurate)
      const distance = calculatePreciseDistance(searchCenter, coordinates);
      newDistances.set(businessId, distance);
      
      if (distance <= maxDistance) {
        businessCoords.set(businessId, coordinates);
      }
    }
  }
  
  // Save new distance calculations to cache (fire and forget)
  if (newDistances.size > 0) {
    setTimeout(() => saveDistanceCache(searchCenter!, newDistances), 0);
  }
  
  // Filter events
  const filteredEvents = events.filter(event => {
    // If we have cached distance info, use it
    if (distanceCache.has(event.businessId)) {
      return distanceCache.get(event.businessId)! <= maxDistance;
    }
    
    // If we calculated new distance, use it
    if (newDistances.has(event.businessId)) {
      return newDistances.get(event.businessId)! <= maxDistance;
    }
    
    // If we have coordinates, it passed our filters
    return businessCoords.has(event.businessId);
  });
  
  return filteredEvents;
};

/**
 * NEW: Filter events by custom map area (with map center and radius)
 */
export const filterEventsByMapArea = async (
  events: any[],
  businesses: any[],
  mapCenter: Coordinates,
  radiusKm: number
): Promise<any[]> => {
  if (radiusKm === 0) return events; // "Any distance" means no filtering
  
  return await filterEventsByDistance(events, businesses, radiusKm, mapCenter);
};

/**
 * NEW: Calculate distance between two coordinates (public utility)
 */
export const calculateDistance = (
  coord1: Coordinates,
  coord2: Coordinates,
  precise: boolean = false
): number => {
  if (precise) {
    return calculatePreciseDistance(coord1, coord2);
  } else {
    return calculateApproximateDistance(coord1, coord2);
  }
};

/**
 * Clear all caches
 */
export const clearLocationCaches = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(GEOCACHE_KEY),
      AsyncStorage.removeItem(USER_LOCATION_KEY),
      AsyncStorage.removeItem(DISTANCE_CACHE_KEY),
      AsyncStorage.removeItem(MAP_CENTER_KEY),
      AsyncStorage.removeItem(LOCATION_FILTER_KEY)
    ]);
  } catch (error) {
    // Silently fail
  }
};