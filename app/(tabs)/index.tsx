// app/(tabs)/index.tsx - WITH MEDIA ERROR HANDLING (Phase 1)
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import * as Calendar from 'expo-calendar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  VirtualizedList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterEventsByDistance, initializeLocationServices } from '../../utils/locationUtils';

// FIREBASE IMPORTS
import { handleFirebaseError } from '../../utils/ErrorHandling';
import {
  lightweightRefresh,
  loadEventsAndBusinesses,
  loadEventsAndBusinessesCached
} from '../../utils/firebaseUtils';

// Import the scroll to top and clear filters functionality
import { setClearFiltersCallback, setScrollToTopCallback } from './_layout';

// Import media detection utilities
import { isVideo } from '../../constants/fileConfig';

const backgroundPattern = require('../../assets/background.png');
const heyByronBlackLogo = require('../../assets/heybyronhorizontallogo.png');

const safeOpenURL = (url: string) => {
  if (!url || !url.trim()) return;
  
  let safeUrl = url.trim();
  if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
    safeUrl = `https://${safeUrl}`;
  }
  
  Linking.openURL(safeUrl);
};

const screenWidth = Dimensions.get('window').width;
const EVENTS_PER_PAGE = 20;

// Fixed heights for predictable layout
const FIXED_HEADER_HEIGHT = 40;
const LOAD_MORE_HEIGHT = 80;

// Updated viewability config for full visibility detection
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 50,
};

// Header animation constants
const HEADER_MAX_HEIGHT = 70;
const HEADER_MIN_HEIGHT = 0;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;
const CONTENT_PADDING_TOP = 35;

// Dark teal gradient
const GRADIENT_COLORS = [
  'rgba(255, 255, 255, 0.96)', 
  'rgb(30, 120, 120)'
] as const;

const HEADER_BASE_TOP = Platform.OS === 'android' ? 48 : 24;

interface RawEvent {
  id: string;
  businessId: string;
  title: string;
  caption?: string;
  date: string;
  link?: string;
  tags: string[];
  image?: string;
  video?: string;
  businessName?: string;
}

interface VirtualItem {
  id: string;
  type: 'header' | 'event' | 'load-more';
  height: number;
  data?: any;
}

// NEW: Media error state interface - SIMPLIFIED
interface MediaErrorState {
  imageError: boolean;
  videoError: boolean;
  retryCount: number;
}

// State management with useReducer
interface AppState {
  allItems: VirtualItem[];
  visibleCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  savedEvents: string[];
  showOnlySaved: boolean;
  aspectRatios: Record<string, number>;
  visibleVideos: Set<string>;
  globalVideoSoundEnabled: boolean;
  calendarEvents: string[];
  calendarEventIds: Record<string, string>;
  firebaseError: string | null;
  refreshing: boolean;
  // NEW: Media error tracking
  mediaErrors: Record<string, MediaErrorState>;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'SET_INITIAL_DATA'; payload: VirtualItem[] }
  | { type: 'LOAD_MORE' }
  | { type: 'SET_SAVED_EVENTS'; payload: string[] }
  | { type: 'TOGGLE_SAVED_FILTER' }
  | { type: 'SET_ASPECT_RATIO'; payload: { id: string; ratio: number } }
  | { type: 'SET_VISIBLE_VIDEOS'; payload: Set<string> }
  | { type: 'TOGGLE_GLOBAL_VIDEO_SOUND' }
  | { type: 'SET_CALENDAR_EVENTS'; payload: string[] }
  | { type: 'ADD_CALENDAR_EVENT'; payload: { eventId: string; calendarEventId: string } }
  | { type: 'REMOVE_CALENDAR_EVENT'; payload: string }
  | { type: 'SET_CALENDAR_EVENT_IDS'; payload: Record<string, string> }
  | { type: 'SET_FIREBASE_ERROR'; payload: string | null }
  | { type: 'SET_REFRESHING'; payload: boolean }
  // NEW: Media error actions - SIMPLIFIED
  | { type: 'SET_MEDIA_ERROR'; payload: { eventId: string; type: 'image' | 'video'; error: boolean } }
  | { type: 'INCREMENT_RETRY_COUNT'; payload: { eventId: string } }
  | { type: 'RESET_MEDIA_ERROR'; payload: { eventId: string } };

const initialState: AppState = {
  allItems: [],
  visibleCount: EVENTS_PER_PAGE,
  loading: true,
  loadingMore: false,
  hasMore: true,
  savedEvents: [],
  showOnlySaved: false,
  aspectRatios: {},
  visibleVideos: new Set(),
  globalVideoSoundEnabled: false,
  calendarEvents: [],
  calendarEventIds: {},
  firebaseError: null,
  refreshing: false,
  mediaErrors: {},
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOADING_MORE':
      return { ...state, loadingMore: action.payload };
    case 'SET_INITIAL_DATA': {
      const eventCount = action.payload.filter(item => item.type === 'event').length;
      return {
        ...state,
        allItems: action.payload,
        visibleCount: Math.min(EVENTS_PER_PAGE, eventCount),
        hasMore: eventCount > EVENTS_PER_PAGE,
        loading: false,
        firebaseError: null,
      };
    }
    case 'LOAD_MORE': {
      const currentEventCount = state.allItems.filter(item => item.type === 'event').length;
      const newCount = Math.min(state.visibleCount + EVENTS_PER_PAGE, currentEventCount);
      return {
        ...state,
        visibleCount: newCount,
        hasMore: newCount < currentEventCount,
        loadingMore: false,
      };
    }
    case 'SET_SAVED_EVENTS':
      return { ...state, savedEvents: action.payload };
    case 'TOGGLE_SAVED_FILTER':
      return { ...state, showOnlySaved: !state.showOnlySaved };
    case 'SET_ASPECT_RATIO':
      return {
        ...state,
        aspectRatios: { ...state.aspectRatios, [action.payload.id]: action.payload.ratio }
      };
    case 'SET_VISIBLE_VIDEOS':
      return { ...state, visibleVideos: action.payload };
    case 'TOGGLE_GLOBAL_VIDEO_SOUND':
      return {
        ...state,
        globalVideoSoundEnabled: !state.globalVideoSoundEnabled
      };
    case 'SET_CALENDAR_EVENTS':
      return { ...state, calendarEvents: action.payload };
    case 'ADD_CALENDAR_EVENT':
      return { 
        ...state, 
        calendarEvents: [...state.calendarEvents, action.payload.eventId],
        calendarEventIds: { 
          ...state.calendarEventIds, 
          [action.payload.eventId]: action.payload.calendarEventId 
        }
      };
    case 'REMOVE_CALENDAR_EVENT': {
      const newCalendarEvents = state.calendarEvents.filter(id => id !== action.payload);
      const newCalendarEventIds = { ...state.calendarEventIds };
      delete newCalendarEventIds[action.payload];
      return { 
        ...state, 
        calendarEvents: newCalendarEvents,
        calendarEventIds: newCalendarEventIds
      };
    }
    case 'SET_CALENDAR_EVENT_IDS':
      return { ...state, calendarEventIds: action.payload };
    case 'SET_FIREBASE_ERROR':
      return { ...state, firebaseError: action.payload, loading: false };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    // NEW: Media error handling - SIMPLIFIED
    case 'SET_MEDIA_ERROR': {
      const { eventId, type, error } = action.payload;
      const currentError = state.mediaErrors[eventId] || {
        imageError: false,
        videoError: false,
        retryCount: 0
      };
      
      return {
        ...state,
        mediaErrors: {
          ...state.mediaErrors,
          [eventId]: {
            ...currentError,
            [`${type}Error`]: error
          }
        }
      };
    }
    case 'INCREMENT_RETRY_COUNT': {
      const { eventId } = action.payload;
      const currentError = state.mediaErrors[eventId] || {
        imageError: false,
        videoError: false,
        retryCount: 0
      };
      
      return {
        ...state,
        mediaErrors: {
          ...state.mediaErrors,
          [eventId]: {
            ...currentError,
            retryCount: currentError.retryCount + 1
          }
        }
      };
    }
    case 'RESET_MEDIA_ERROR': {
      const { eventId } = action.payload;
      return {
        ...state,
        mediaErrors: {
          ...state.mediaErrors,
          [eventId]: {
            imageError: false,
            videoError: false,
            retryCount: 0
          }
        }
      };
    }
    default:
      return state;
  }
}

// Utility function to create virtual items
const createVirtualItems = (events: RawEvent[]): VirtualItem[] => {
  const items: VirtualItem[] = [];
  const eventsByDate: Record<string, RawEvent[]> = {};

  // Group events by date (YYYY-MM-DD)
  events.forEach(event => {
    const dateKey = event.date.slice(0, 10);
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  // Sort dates, then push a header + its events
  const sortedDates = Object.keys(eventsByDate).sort();
  sortedDates.forEach(date => {
    items.push({
      id: `header-${date}`,
      type: 'header',
      height: FIXED_HEADER_HEIGHT,
      data: {
        title: formatDateHeader(date),
        date,
      }
    });

    eventsByDate[date]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(event => {
        items.push({
          id: event.id,
          type: 'event',
          height: 0, // Dynamic height
          data: event,
        });
      });
  });

  return items;
};

// Memoized date formatter
const formatDateHeader = (dateString: string): string => {
  const eventDate = new Date(`${dateString}T00:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  if (eventDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  const day = eventDate.getDate();
  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';
  const month = eventDate.toLocaleString('default', { month: 'long' });
  return `${month} ${day}${suffix}`;
};

// Data change detection hash function
const createDataHash = (events: any[]): string => {
  if (events.length === 0) return '0';
  const eventIds = events.map(e => e.id).sort().join(',');
  const eventCount = events.length;
  return `${eventCount}-${eventIds}`;
};

// Section Header Component
const SectionHeader = React.memo(({ title }: { title: string }) => (
  <View style={[styles.dateSeparator, { height: FIXED_HEADER_HEIGHT }]}>
    <Text style={styles.dateText}>{title}</Text>
  </View>
));

// NEW: Media Error/Loading Component - SIMPLIFIED
const MediaErrorPlaceholder = React.memo(({ 
  type, 
  hasError, 
  onRetry, 
  retryCount 
}: { 
  type: 'image' | 'video';
  hasError: boolean;
  onRetry: () => void;
  retryCount: number;
}) => {
  if (hasError) {
    return (
      <View style={styles.mediaPlaceholder}>
        <Ionicons 
          name={type === 'video' ? 'videocam-off' : 'image-outline'} 
          size={48} 
          color="rgba(255, 255, 255, 0.6)" 
        />
        <Text style={styles.mediaPlaceholderText}>
          {type === 'video' ? 'Video failed to load' : 'Image failed to load'}
        </Text>
        {retryCount < 3 && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
        {retryCount >= 3 && (
          <Text style={styles.maxRetriesText}>Check your connection</Text>
        )}
      </View>
    );
  }

  return null;
});

// Event Item Component - UPDATED with media error handling
const EventItem = React.memo(({ 
  item,
  isVisible,
  aspectRatio,
  isSaved,
  isSoundEnabled,
  isInCalendar,
  mediaError,
  onAspectRatioChange,
  onToggleSaveEvent,
  onToggleVideoSound,
  onAddToCalendar,
  onRemoveFromCalendar,
  onMediaError,
  onMediaLoading,
  onRetryMedia,
  onResetMediaError
}: {
  item: RawEvent;
  isVisible: boolean;
  aspectRatio?: number;
  isSaved: boolean;
  isSoundEnabled: boolean;
  isInCalendar: boolean;
  mediaError: MediaErrorState;
  onAspectRatioChange: (id: string, ratio: number) => void;
  onToggleSaveEvent: (id: string) => void;
  onToggleVideoSound: () => void;
  onAddToCalendar: (eventId: string) => void;
  onRemoveFromCalendar: (eventId: string) => void;
  onMediaError: (eventId: string, type: 'image' | 'video') => void;
  onMediaLoading: (eventId: string, type: 'image' | 'video', loading: boolean) => void;
  onRetryMedia: (eventId: string) => void;
  onResetMediaError: (eventId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const time = useMemo(() => 
    new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
    [item.date]
  );

  const { mediaUri, isVideo: shouldShowAsVideo } = useMemo(() => {
    const uri = item.video || item.image;
    return {
      mediaUri: uri,
      isVideo: isVideo(uri)
    };
  }, [item.video, item.image]);

  const handlePress = useCallback(() => {
    if (item.link) {
      safeOpenURL(item.link);
    }
  }, [item.link]);

  const toggleExpand = useCallback((e: any) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  // NEW: Handle image load success - SIMPLIFIED
  const handleImageLoad = useCallback((e: any) => {
    const { width: imgW, height: imgH } = e.nativeEvent.source;
    if (imgW && imgH) {
      onAspectRatioChange(item.id, imgW / imgH);
    }
    // Clear any previous errors
    onResetMediaError(item.id);
  }, [item.id, onAspectRatioChange, onResetMediaError]);

  // NEW: Handle image load error - SIMPLIFIED
  const handleImageError = useCallback(() => {
    console.log('Image failed to load for event:', item.id);
    onMediaError(item.id, 'image');
  }, [item.id, onMediaError]);

  // NEW: Handle video load success - SIMPLIFIED
  const handleVideoReady = useCallback((event: any) => {
    const vidW = event.naturalSize?.width;
    const vidH = event.naturalSize?.height;
    if (vidW && vidH) {
      onAspectRatioChange(item.id, vidW / vidH);
    }
    // Clear any previous errors
    onResetMediaError(item.id);
  }, [item.id, onAspectRatioChange, onResetMediaError]);

  // NEW: Handle video load error - SIMPLIFIED
  const handleVideoError = useCallback((error: any) => {
    console.log('Video failed to load for event:', item.id, error);
    onMediaError(item.id, 'video');
  }, [item.id, onMediaError]);

  // NEW: Handle retry
  const handleRetry = useCallback(() => {
    onRetryMedia(item.id);
  }, [item.id, onRetryMedia]);

  const handleSavePress = useCallback(() => {
    onToggleSaveEvent(item.id);
  }, [item.id, onToggleSaveEvent]);

  const handleSoundToggle = useCallback(() => {
    onToggleVideoSound();
  }, [onToggleVideoSound]);

  const handleCalendarPress = useCallback(() => {
    if (isInCalendar) {
      onRemoveFromCalendar(item.id);
    } else {
      onAddToCalendar(item.id);
    }
  }, [item.id, isInCalendar, onAddToCalendar, onRemoveFromCalendar]);

  // NEW: Determine what to show for media - SIMPLIFIED
  const renderMedia = () => {
    if (!mediaUri) return null;

    if (shouldShowAsVideo) {
      // Show video error placeholder if there's an error
      if (mediaError.videoError) {
        return (
          <MediaErrorPlaceholder
            type="video"
            hasError={mediaError.videoError}
            onRetry={handleRetry}
            retryCount={mediaError.retryCount}
          />
        );
      }

      // Show video (let React Native handle loading states)
      return (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: mediaUri }}
            style={{
              width: screenWidth,
              height: aspectRatio ? screenWidth / aspectRatio : screenWidth / 1,
              backgroundColor: '#000',
            }}
            resizeMode="contain"
            isLooping
            shouldPlay={isVisible}
            isMuted={!isSoundEnabled}
            onReadyForDisplay={handleVideoReady}
            onError={handleVideoError}
            useNativeControls={false}
          />
          <TouchableOpacity 
            style={styles.soundToggle} 
            onPress={handleSoundToggle}
          >
            <Text style={styles.soundIcon}>
              {isSoundEnabled ? '♪' : '✕'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      // Show image error placeholder if there's an error
      if (mediaError.imageError) {
        return (
          <MediaErrorPlaceholder
            type="image"
            hasError={mediaError.imageError}
            onRetry={handleRetry}
            retryCount={mediaError.retryCount}
          />
        );
      }

      // Show image (let React Native handle loading states)
      return (
        <Image
          source={{ uri: mediaUri }}
          style={{
            width: screenWidth,
            aspectRatio: aspectRatio || 1,
          }}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      );
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
      <View style={styles.cardContainer}>
        <View style={styles.businessNameHeader}>
          <Text style={styles.businessNameText}>{item.businessName}</Text>
        </View>

        {renderMedia()}

        <View style={styles.captionContainer}>
          <View style={styles.captionContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.cardTitle}>
                {item.title}
              </Text>
              {item.caption && (
                <>
                  {isExpanded && (
                    <Text style={styles.cardCaption}>
                      {item.caption}
                    </Text>
                  )}
                  <TouchableOpacity onPress={toggleExpand} style={styles.seeMoreButton}>
                    <Text style={styles.seeMoreText}>
                      {isExpanded ? 'See less' : 'See more'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={styles.cardTime}>{time}</Text>
          </View>
          <View style={styles.actionButtons}>
            {isSaved && (
              <TouchableOpacity 
                style={styles.calendarButton} 
                onPress={handleCalendarPress}
              >
                <Ionicons 
                  name={isInCalendar ? "checkmark-circle" : "calendar-outline"} 
                  size={22} 
                  color="rgba(194, 164, 120, 1)" 
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSavePress} style={styles.saveButton}>
              <Text style={styles.saveIcon}>{isSaved ? '★' : '☆'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Load More Button Component
const LoadMoreButton = React.memo(({ 
  loadingMore, 
  onLoadMore 
}: {
  loadingMore: boolean;
  onLoadMore: () => void;
}) => (
  <View style={[styles.loadMoreContainer, { height: LOAD_MORE_HEIGHT }]}>
    <TouchableOpacity 
      style={styles.loadMoreButton} 
      onPress={onLoadMore}
      disabled={loadingMore}
    >
      {loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingMoreText}>Loading more events...</Text>
        </View>
      ) : (
        <Text style={styles.loadMoreButtonText}>Load More Events</Text>
      )}
    </TouchableOpacity>
  </View>
));

// Firebase Error Component
const FirebaseErrorComponent = React.memo(({ 
  error, 
  onRetry 
}: {
  error: string;
  onRetry: () => void;
}) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Unable to load events</Text>
    <Text style={styles.errorMessage}>{error}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Text style={styles.retryButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
));

export default function WhatsOnScreen() {
  const router = useRouter();
  const { date: forcedDate, startDate, endDate, businessId } = useLocalSearchParams<{
    date?: string;
    startDate?: string;
    endDate?: string;
    businessId?: string;
  }>();

  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [floatingDate, setFloatingDate] = useState<string>('');
  const [lastDataHash, setLastDataHash] = useState<string>('');
  const itemPositions = useRef<Map<string, number>>(new Map());

  // Header animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerOffset = useRef(new Animated.Value(0)).current;

  const virtualizedListRef = useRef<VirtualizedList<VirtualItem>>(null);
  const loadingRef = useRef(false);
  const businessMap = useRef<Record<string, string>>({});

  // Header animation interpolations
  const headerTranslateY = useMemo(
    () =>
      headerOffset.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, -HEADER_MAX_HEIGHT],
        extrapolate: 'clamp',
      }),
    [headerOffset]
  );

  const headerOpacity = useMemo(
    () =>
      headerOffset.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp',
      }),
    [headerOffset]
  );

  const headerHeight = useMemo(
    () =>
      headerOffset.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
        extrapolate: 'clamp',
      }),
    [headerOffset]
  );

  const contentPaddingTop = useMemo(
    () =>
      headerOffset.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [CONTENT_PADDING_TOP, HEADER_MIN_HEIGHT],
        extrapolate: 'clamp',
      }),
    [headerOffset]
  );

  const bannerTop = useMemo(
    () =>
      headerOffset.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [
          (Platform.OS === 'android' ? 48 : insets.top - 20) + HEADER_MAX_HEIGHT - 15,
          Platform.OS === 'android' ? 48 : insets.top
        ],
        extrapolate: 'clamp',
      }),
    [headerOffset, insets.top]
  );

  // Get visible items including load more button
  const visibleItems = useMemo(() => {
    let eventCount = 0;
    const result: VirtualItem[] = [];
    let pendingHeader: VirtualItem | null = null;

    for (const item of state.allItems) {
      if (item.type === 'header') {
        pendingHeader = item;
      } else if (item.type === 'event') {
        eventCount++;
        if (eventCount <= state.visibleCount) {
          if (pendingHeader) {
            result.push(pendingHeader);
            pendingHeader = null;
          }
          result.push(item);
        }
      }
    }

    if (state.hasMore && !state.loading) {
      result.push({
        id: 'load-more',
        type: 'load-more',
        height: LOAD_MORE_HEIGHT,
        data: null,
      });
    }

    return result;
  }, [state.allItems, state.visibleCount, state.hasMore, state.loading]);

  // Initialize location services
  const initializeLocation = useCallback(async () => {
    if (!businessId && !forcedDate && !startDate && !endDate) {
      initializeLocationServices();
    }
  }, [businessId, forcedDate, startDate, endDate]);

  // FIREBASE: loadEventsData function
  const loadEventsData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      console.log('🔥 Loading events (checking preloaded cache)...');
      
      let allEvents: RawEvent[] = [];
      let businesses: any[] = [];

      // UPDATED: Use smart cache for main feed, direct Firebase for specific queries
      if (businessId) {
        const { events: loadedEvents, businesses: loadedBusinesses } = await loadEventsAndBusinesses();
        allEvents = loadedEvents.filter(e => e.businessId === businessId);
        businesses = loadedBusinesses;
      } else {
        const { events: loadedEvents, businesses: loadedBusinesses } = await loadEventsAndBusinessesCached({
          forcedDate,
          startDate,
          endDate,
          businessId
        });
        allEvents = loadedEvents;
        businesses = loadedBusinesses;
      }

      // Update business map cache
      businessMap.current = businesses.reduce((map: Record<string, string>, biz: any) => {
        map[biz.id] = biz.name;
        return map;
      }, {});

      console.log(`✅ Loaded ${allEvents.length} events and ${businesses.length} businesses from Firebase`);

      // TIMEZONE FIX: Use local timezone instead of UTC
      const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const todayString = getLocalDateString();

      // Filter by date first - handle single date, date range, or future events
      let filtered = allEvents.filter(e => {
        const eventDateString = e.date.slice(0, 10);
        
        if (forcedDate) {
          return eventDateString === forcedDate;
        } else if (startDate && endDate) {
          return eventDateString >= startDate && eventDateString <= endDate;
        } else {
          return eventDateString >= todayString;
        }
      });

      // Apply saved events filter
      if (state.showOnlySaved) {
        const saved = await AsyncStorage.getItem('savedEvents');
        const ids = saved ? JSON.parse(saved) : [];
        filtered = filtered.filter(e => ids.includes(e.id));
      }

      // Apply interest and location filters
      if (!forcedDate && !startDate && !endDate && !businessId) {
        if (!state.showOnlySaved) {
          const rawInt = await AsyncStorage.getItem('userInterests');
          const ints = (rawInt ? JSON.parse(rawInt) : []).map((i: string) =>
            i.toLowerCase().trim()
          );
          if (ints.length) {
            filtered = filtered.filter(e =>
              e.tags.some(tag => ints.includes(tag.toLowerCase().trim()))
            );
          } else {
            filtered = [];
          }
        }

        // Apply location filtering
        const [rawDistance, rawLocationFilter, rawMapCenter] = await Promise.all([
          AsyncStorage.getItem('userDistance'),
          AsyncStorage.getItem('locationFilterEnabled'),
          AsyncStorage.getItem('mapCenter')
        ]);

        const selectedDistance = rawDistance ? JSON.parse(rawDistance) : null;
        const locationFilterEnabled = rawLocationFilter ? JSON.parse(rawLocationFilter) : false;
        const mapCenter = rawMapCenter ? JSON.parse(rawMapCenter) : null;

        if (locationFilterEnabled && selectedDistance) {
          filtered = await filterEventsByDistance(
            filtered, 
            businesses, 
            selectedDistance, 
            mapCenter
          );
        }
      }

      // Add business names and sort
      filtered = filtered.map(ev => ({
        ...ev,
        businessName: businessMap.current[ev.businessId] || 'Unknown'
      }));
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Check if data actually changed
      const newDataHash = createDataHash(filtered);
      if (newDataHash === lastDataHash && lastDataHash !== '') {
        console.log('📱 No changes detected - skipping update');
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      console.log('📱 Data changed - updating feed');
      setLastDataHash(newDataHash);

      // Create virtual items
      const virtualItems = createVirtualItems(filtered);
      dispatch({ type: 'SET_INITIAL_DATA', payload: virtualItems });
      
      // Auto-scroll for date filtering
      if (forcedDate || startDate || endDate) {
        setTimeout(() => {
          if (virtualizedListRef.current) {
            virtualizedListRef.current.scrollToOffset({ offset: 0, animated: false });
          }
        }, 50);
      }
      
    } catch (error) {
      console.error('❌ Error loading events:', error);
      const errorMessage = handleFirebaseError(error);      dispatch({ type: 'SET_FIREBASE_ERROR', payload: errorMessage });
    } finally {
      loadingRef.current = false;
    }
  }, [forcedDate, startDate, endDate, businessId, state.showOnlySaved, lastDataHash]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    
    try {
      console.log('🔄 Pull-to-refresh: checking for new events...');
      
      // Lightweight check: only loads new events if they exist
      const hasNewEvents = await lightweightRefresh();
      
      if (hasNewEvents) {
        console.log('✅ New events found, updating feed...');
        // Reload the data to apply filtering to new events
        await loadEventsData();
      } else {
        console.log('✅ No new events, feed is current');
        // Just complete the refresh animation without reloading
      }
      
    } catch (error) {
      console.error('❌ Error during refresh:', error);
      // Still complete the refresh animation
    } finally {
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, [loadEventsData]);

  // Retry function for Firebase errors
  const retryLoadEvents = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_FIREBASE_ERROR', payload: null });
    loadEventsData();
  }, [loadEventsData]);

  // NEW: Media error handlers - SIMPLIFIED
  const handleMediaError = useCallback((eventId: string, type: 'image' | 'video') => {
    dispatch({ type: 'SET_MEDIA_ERROR', payload: { eventId, type, error: true } });
  }, []);

  const handleRetryMedia = useCallback((eventId: string) => {
    dispatch({ type: 'INCREMENT_RETRY_COUNT', payload: { eventId } });
    dispatch({ type: 'RESET_MEDIA_ERROR', payload: { eventId } });
    // Force re-render by updating a timestamp or similar
    setTimeout(() => {
      // This will trigger a re-render of the component
      dispatch({ type: 'SET_MEDIA_ERROR', payload: { eventId, type: 'image', error: false } });
    }, 100);
  }, []);

  const handleResetMediaError = useCallback((eventId: string) => {
    dispatch({ type: 'RESET_MEDIA_ERROR', payload: { eventId } });
  }, []);

  const loadMoreEvents = useCallback(() => {
    if (state.loadingMore || !state.hasMore || loadingRef.current) return;

    dispatch({ type: 'SET_LOADING_MORE', payload: true });

    setTimeout(() => {
      dispatch({ type: 'LOAD_MORE' });
    }, 100);
  }, [state.loadingMore, state.hasMore]);

  const toggleSaveEvent = useCallback(
    async (eventId: string) => {
      const newSaved = state.savedEvents.includes(eventId)
        ? state.savedEvents.filter(id => id !== eventId)
        : [...state.savedEvents, eventId];
      dispatch({ type: 'SET_SAVED_EVENTS', payload: newSaved });
      AsyncStorage.setItem('savedEvents', JSON.stringify(newSaved)).catch(console.error);
    },
    [state.savedEvents]
  );

  const handleAspectRatioChange = useCallback((eventId: string, ratio: number) => {
    dispatch({ type: 'SET_ASPECT_RATIO', payload: { id: eventId, ratio } });
  }, []);

  const handleToggleVideoSound = useCallback(() => {
    dispatch({ type: 'TOGGLE_GLOBAL_VIDEO_SOUND' });
  }, []);

  // Calendar functionality
  const addEventToCalendar = useCallback(async (eventId: string) => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        alert('Calendar permission is required to add events');
        return;
      }

      const eventData = state.allItems.find(item => 
        item.type === 'event' && item.data.id === eventId
      )?.data;
      
      if (!eventData) return;

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let defaultCalendar = calendars.find(cal => 
        cal.allowsModifications && 
        cal.source.type === Calendar.SourceType.LOCAL
      );

      if (!defaultCalendar) {
        defaultCalendar = calendars.find(cal => 
          cal.allowsModifications && 
          cal.source.type === Calendar.SourceType.CALDAV &&
          cal.source.name === 'iCloud'
        );
      }

      if (!defaultCalendar) {
        defaultCalendar = calendars.find(cal => cal.allowsModifications);
      }

      if (!defaultCalendar) {
        const defaultCalendarSource = {
          type: Calendar.SourceType.LOCAL,
          name: 'Default',
          isLocalAccount: true,
        };

        const newCalendarId = await Calendar.createCalendarAsync({
          title: 'Events',
          color: 'blue',
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: defaultCalendarSource.id,
          source: defaultCalendarSource,
          name: 'Events',
          ownerAccount: 'personal',
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });

        defaultCalendar = await Calendar.getCalendarAsync(newCalendarId);
      }
      
      if (!defaultCalendar) {
        alert('Unable to access or create a calendar. Please check your device calendar settings.');
        return;
      }

      const eventDate = new Date(eventData.date);
      const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

      const calendarEvent = {
        title: eventData.title,
        notes: eventData.caption || '',
        startDate: eventDate,
        endDate: endDate,
        timeZone: 'Australia/Sydney',
        location: businessMap.current[eventData.businessId] || '',
      };

      const createdEventId = await Calendar.createEventAsync(defaultCalendar.id, calendarEvent);
      
      dispatch({ 
        type: 'ADD_CALENDAR_EVENT', 
        payload: { eventId, calendarEventId: createdEventId } 
      });
      
      const newCalendarEvents = [...state.calendarEvents, eventId];
      const newCalendarEventIds = { ...state.calendarEventIds, [eventId]: createdEventId };
      await Promise.all([
        AsyncStorage.setItem('calendarEvents', JSON.stringify(newCalendarEvents)),
        AsyncStorage.setItem('calendarEventIds', JSON.stringify(newCalendarEventIds))
      ]);
      
      alert('Event added to calendar successfully!');
      
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      alert(`Failed to add event to calendar: ${error.message}`);
    }
  }, [state.allItems, state.calendarEvents, state.calendarEventIds]);

  const removeEventFromCalendar = useCallback(async (eventId: string) => {
    try {
      const calendarEventId = state.calendarEventIds[eventId];
      if (!calendarEventId) {
        console.warn('No calendar event ID found for event:', eventId);
        return;
      }

      await Calendar.deleteEventAsync(calendarEventId);
      
      dispatch({ type: 'REMOVE_CALENDAR_EVENT', payload: eventId });
      
      const newCalendarEvents = state.calendarEvents.filter(id => id !== eventId);
      const newCalendarEventIds = { ...state.calendarEventIds };
      delete newCalendarEventIds[eventId];
      
      await Promise.all([
        AsyncStorage.setItem('calendarEvents', JSON.stringify(newCalendarEvents)),
        AsyncStorage.setItem('calendarEventIds', JSON.stringify(newCalendarEventIds))
      ]);
      
      alert('Event removed from calendar successfully!');
      
    } catch (error) {
      console.error('Error removing event from calendar:', error);
      alert(`Failed to remove event from calendar: ${error.message}`);
    }
  }, [state.calendarEvents, state.calendarEventIds]);

  const handleScroll = useCallback(
    (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
      const scrollDelta = currentScrollY - lastScrollY.current;

      if (
        currentScrollY < 0 ||
        currentScrollY > contentHeight - scrollViewHeight ||
        state.loadingMore
      ) {
        lastScrollY.current = currentScrollY;
        return;
      }

      if (Math.abs(scrollDelta) > 2) {
        const direction = scrollDelta > 0 ? 'down' : 'up';
        const currentOffset = (headerOffset as any)._value || 0;

        if (direction === 'down') {
          const newOffset = Math.min(
            currentOffset + Math.abs(scrollDelta) * 0.8,
            HEADER_SCROLL_DISTANCE
          );
          Animated.timing(headerOffset, {
            toValue: newOffset,
            duration: 0,
            useNativeDriver: false,
          }).start();
        } else {
          const newOffset = Math.max(currentOffset - Math.abs(scrollDelta) * 0.8, 0);
          Animated.timing(headerOffset, {
            toValue: newOffset,
            duration: 0,
            useNativeDriver: false,
          }).start();
        }
      }

      lastScrollY.current = currentScrollY;
    },
    [headerOffset, state.loadingMore]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      // Get all currently visible items
      const visibleItems = viewableItems
        .filter((v: any) => v.isViewable)
        .sort((a: any, b: any) => a.index - b.index);

      if (visibleItems.length > 0) {
        // Find the first visible item (topmost on screen)
        const firstVisible = visibleItems[0].item;
        
        if (firstVisible.type === 'header') {
          // If the first visible item is a header, use that date
          setFloatingDate(firstVisible.data.title);
        } else if (firstVisible.type === 'event') {
          // If the first visible item is an event, use its date
          const dateKey = firstVisible.data.date.slice(0, 10);
          setFloatingDate(formatDateHeader(dateKey));
        }
      }
      
      // Keep the video visibility logic
      const fullyVisibleVideoIds = new Set<string>();
      viewableItems.forEach((viewableItem: any) => {
        const { item, isViewable } = viewableItem;
        if (item.type === 'event' && item.data && isViewable) {
          const eventData = item.data;
          const uri = eventData.video || eventData.image;
          const shouldShowAsVideo = isVideo(uri);
          if (shouldShowAsVideo) {
            fullyVisibleVideoIds.add(eventData.id);
          }
        }
      });
      dispatch({ type: 'SET_VISIBLE_VIDEOS', payload: fullyVisibleVideoIds });
    },
    []
  );

  const loadSavedEvents = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('savedEvents');
      dispatch({ type: 'SET_SAVED_EVENTS', payload: saved ? JSON.parse(saved) : [] });
    } catch {
      dispatch({ type: 'SET_SAVED_EVENTS', payload: [] });
    }
  }, []);

  const loadCalendarEvents = useCallback(async () => {
    try {
      const [calendarEvents, calendarEventIds] = await Promise.all([
        AsyncStorage.getItem('calendarEvents'),
        AsyncStorage.getItem('calendarEventIds')
      ]);
      
      dispatch({ 
        type: 'SET_CALENDAR_EVENTS', 
        payload: calendarEvents ? JSON.parse(calendarEvents) : [] 
      });
      dispatch({ 
        type: 'SET_CALENDAR_EVENT_IDS', 
        payload: calendarEventIds ? JSON.parse(calendarEventIds) : {} 
      });
    } catch {
      dispatch({ type: 'SET_CALENDAR_EVENTS', payload: [] });
      dispatch({ type: 'SET_CALENDAR_EVENT_IDS', payload: {} });
    }
  }, []);

  const toggleShowOnlySaved = useCallback(() => {
    dispatch({ type: 'TOGGLE_SAVED_FILTER' });
  }, []);

  const scrollToTop = useCallback(() => {
    if (virtualizedListRef.current) {
      virtualizedListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const clearFilters = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // VirtualizedList methods
  const getItem = useCallback((data: VirtualItem[], index: number) => data[index], []);
  const getItemCount = useCallback((data: VirtualItem[]) => data.length, []);
  const keyExtractor = useCallback((item: VirtualItem) => item.id, []);

  const getItemLayout = undefined;

  const renderItem = useCallback(
    ({ item }: { item: VirtualItem }) => {
      if (item.type === 'header') {
        return <SectionHeader title={item.data.title} />;
      }
      if (item.type === 'event') {
        const eventId = item.data.id;
        const mediaError = state.mediaErrors[eventId] || {
          imageError: false,
          videoError: false,
          retryCount: 0
        };

        return (
          <EventItem
            item={item.data}
            isVisible={state.visibleVideos.has(item.data.id)}
            aspectRatio={state.aspectRatios[item.data.id]}
            isSaved={state.savedEvents.includes(item.data.id)}
            isSoundEnabled={state.globalVideoSoundEnabled}
            isInCalendar={state.calendarEvents.includes(item.data.id)}
            mediaError={mediaError}
            onAspectRatioChange={handleAspectRatioChange}
            onToggleSaveEvent={toggleSaveEvent}
            onToggleVideoSound={handleToggleVideoSound}
            onAddToCalendar={addEventToCalendar}
            onRemoveFromCalendar={removeEventFromCalendar}
            onMediaError={handleMediaError}
            onRetryMedia={handleRetryMedia}
            onResetMediaError={handleResetMediaError}
          />
        );
      }
      if (item.type === 'load-more') {
        return <LoadMoreButton loadingMore={state.loadingMore} onLoadMore={loadMoreEvents} />;
      }
      return null;
    },
    [
      state.visibleVideos,
      state.aspectRatios,
      state.savedEvents,
      state.globalVideoSoundEnabled,
      state.loadingMore,
      state.calendarEvents,
      state.mediaErrors,
      handleAspectRatioChange,
      toggleSaveEvent,
      handleToggleVideoSound,
      loadMoreEvents,
      addEventToCalendar,
      removeEventFromCalendar,
      handleMediaError,
      handleRetryMedia,
      handleResetMediaError,
    ]
  );

  useEffect(() => {
    if ((forcedDate || startDate || endDate) && !state.loading && !state.loadingMore && visibleItems.length > 0) {
      const timer = setTimeout(() => {
        if (virtualizedListRef.current) {
          virtualizedListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [forcedDate, startDate, endDate, state.loading]);

  const virtualizedListProps = useMemo(() => {
    const baseProps = {
      ref: virtualizedListRef,
      data: visibleItems,
      getItem,
      getItemCount,
      keyExtractor,
      renderItem,
      getItemLayout,
      onViewableItemsChanged: handleViewableItemsChanged,
      viewabilityConfig: VIEWABILITY_CONFIG,
      contentContainerStyle: styles.listContent,
      onScroll: handleScroll,
      scrollEventThrottle: 16,
      removeClippedSubviews: false,
      maxToRenderPerBatch: 5,
      initialNumToRender: 8,
      windowSize: 21,
      updateCellsBatchingPeriod: 100,
      refreshControl: (
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={handleRefresh}
          tintColor="rgba(194, 164, 120, 1)"
          colors={["rgba(194, 164, 120, 1)"]}
        />
      ),
    };

    if (!forcedDate && !startDate && !endDate) {
      return {
        ...baseProps,
        maintainVisibleContentPosition: {
          minIndexForVisible: 1,
          autoscrollToTopThreshold: 10,
        },
      };
    }

    return baseProps;
  }, [
    visibleItems,
    handleViewableItemsChanged,
    handleScroll,
    renderItem,
    forcedDate,
    startDate,
    endDate,
    state.refreshing,
    handleRefresh,
  ]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      
      setScrollToTopCallback(scrollToTop);
      if (forcedDate || startDate || endDate || businessId) {
        setClearFiltersCallback(clearFilters);
      } else {
        setClearFiltersCallback(null);
      }
      
      (async () => {
        await initializeLocation();
        await loadSavedEvents();
        await loadCalendarEvents();
        if (active) {
          dispatch({ type: 'SET_LOADING', payload: true });
          await loadEventsData();
        }
      })();
      
      return () => {
        active = false;
        setScrollToTopCallback(null);
        setClearFiltersCallback(null);
        dispatch({ type: 'SET_VISIBLE_VIDEOS', payload: new Set() });
      };
    }, [forcedDate, startDate, endDate, businessId, state.showOnlySaved, scrollToTop, clearFilters, lastDataHash])
  );

  const emptyMessage = useMemo(() => {
    if (businessId) return 'No events for this business.';
    
    if (startDate && endDate) {
      const start = formatDateHeader(startDate);
      const end = formatDateHeader(endDate);
      if (state.showOnlySaved) {
        return `No saved events found from ${start} to ${end}.`;
      }
      return `No events found from ${start} to ${end}.`;
    }
    
    if (forcedDate && state.showOnlySaved) return `No saved events found for ${formatDateHeader(forcedDate)}.`;
    if (forcedDate) return `No events found for ${formatDateHeader(forcedDate)}.`;
    if (state.showOnlySaved) return 'No saved events found.';
    return 'No upcoming events match your interests.';
  }, [businessId, forcedDate, startDate, endDate, state.showOnlySaved]);

  const navigateBack = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
      <LinearGradient colors={GRADIENT_COLORS} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={[styles.safe, { paddingTop: 0 }]}>
        <Animated.View
          style={[
            styles.headerContainer,
            {
              top: Platform.OS === 'android' ? 48 : insets.top - 20,
              height: headerHeight,
              transform: [{ translateY: headerTranslateY }],
              opacity: headerOpacity,
            },
          ]}
        >
          <TouchableOpacity style={styles.logoButton} onPress={() => {
            console.log('🔥 Logo button pressed!');
            console.log('🚀 Attempting navigation...');
            router.replace('../');
            console.log('✅ Navigation called');
          }}>
            <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.savedToggle} onPress={toggleShowOnlySaved}>
            <Text style={styles.star}>{state.showOnlySaved ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.floatingDateBanner,
            {
              top: bannerTop,
            },
          ]}
        >
          <Text style={styles.floatingDateText}>{floatingDate}</Text>
        </Animated.View>

        <Animated.View style={[styles.listContainer, { paddingTop: contentPaddingTop }]}>
          {state.loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="rgba(194, 164, 120, 1)" />
              <Text style={styles.loadingText}>Loading events from server...</Text>
            </View>
          ) : state.firebaseError ? (
            <FirebaseErrorComponent error={state.firebaseError} onRetry={retryLoadEvents} />
          ) : !visibleItems.length ? (
            <View style={styles.center}>
              <Text style={styles.empty}>{emptyMessage}</Text>
            </View>
          ) : (
            <VirtualizedList {...virtualizedListProps} />
          )}
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

WhatsOnScreen.options = { headerShown: false };

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingTop: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'absolute',
    top: HEADER_BASE_TOP,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  savedToggle: {
    position: 'absolute',
    right: 16,
    padding: 12,
  },
  star: {
    fontSize: 26,
    color: 'rgba(194, 164, 120, 1)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: 'rgba(194, 164, 120, 1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  dateSeparator: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(194, 164, 120, 1)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 20,
  },
  businessNameHeader: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  businessNameText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // NEW: Media placeholder styles
  mediaPlaceholder: {
    width: screenWidth,
    height: screenWidth / 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mediaPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  maxRetriesText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
  },
  soundToggle: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  soundIcon: {
    fontSize: 16,
    color: '#000',
    fontWeight: '700',
  },
  captionContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 5,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  captionContent: {
    flex: 1,
    marginRight: 16,
  },
  titleContainer: {
    marginBottom: 10,
  },
  cardTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 2,
  },
  cardCaption: {
    color: '#4a4a4a',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  cardTime: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    padding: 12,
  },
  calendarButton: {
    padding: 12,
  },
  saveIcon: {
    fontSize: 22,
    color: 'rgba(194, 164, 120, 1)',
  },
  seeMoreButton: {
    marginBottom: -3,
  },
  seeMoreText: {
    color: 'rgba(194, 164, 120, 1)',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loadMoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingMoreText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.9,
  },
  logoButton: {
    position: 'absolute',
    left: 6,
    padding: 8,
    zIndex: 1,
  },
  logoImage: {
    width: 150,
    height: 50,
  },
  floatingDateBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FIXED_HEADER_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    paddingHorizontal: 16, 
  },
  floatingDateText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(194, 164, 120, 1)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});