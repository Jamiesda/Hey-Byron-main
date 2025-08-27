// utils/firebaseUtils.ts - COMPLETE UPDATED VERSION with business image support

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { db } from '../firebaseConfig';

// Initialize Firebase Storage
const storage = getStorage();

// ==========================================
// INTERFACES
// ==========================================

export interface FirebaseEvent {
  id: string;
  businessId: string;
  title: string;
  caption?: string;
  date: string;
  link?: string;
  tags: string[];
  image?: string;
  video?: string;
  createdAt: string;
  updatedAt: string;
  // Recurring event fields
  recurringSeriesId?: string;
  recurringIndex?: number;
  totalRecurringEvents?: number;
}

export interface FirebaseBusiness {
  id: string;
  name: string;
  address: string;
  description: string;
  website?: string;
  tags: string[];
  socialLinks: string[];
  image?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if Firebase is connected
 */
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    const testCollection = collection(db, 'businesses');
    const testQuery = query(testCollection, limit(1));
    await getDocs(testQuery);
    
    console.log('✅ Firebase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
};

// ==========================================
// FILE MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Upload file to Firebase Storage with hybrid filename for reliable Cloud Function processing
 */
export const uploadToFirebaseStorage = async (
  uri: string, 
  filename: string,
  eventId?: string // New optional parameter for hybrid filenames
): Promise<string> => {
  try {
    console.log('Uploading file to Firebase Storage:', { uri, filename, eventId });
    
    // Create hybrid filename if eventId provided
    let finalFilename = filename;
    if (eventId) {
      const ext = filename.split('.').pop() || 'file';
      const timestamp = Date.now();
      finalFilename = `${eventId}_${timestamp}.${ext}`;
      console.log('Using hybrid filename for reliable processing:', finalFilename);
    }
    
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, `events/${finalFilename}`);
    
    const uploadResult = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    console.log('✅ File uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading file to Firebase Storage:', error);
    throw error;
  }
};

/**
 * Upload business image to Firebase Storage with compression
 */
export const uploadBusinessImageToFirebase = async (
  uri: string, 
  businessId: string
): Promise<string> => {
  try {
    console.log('Uploading business image to Firebase Storage:', { uri, businessId });
    
    // Create business-specific filename
    const timestamp = Date.now();
    const ext = uri.split('.').pop() || 'jpg';
    const filename = `business_${businessId}_${timestamp}.${ext}`;
    
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Upload to businesses/ folder instead of events/
    const storageRef = ref(storage, `businesses/${filename}`);
    
    const uploadResult = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    console.log('✅ Business image uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading business image to Firebase Storage:', error);
    throw error;
  }
};

/**
 * Delete business image from Firebase Storage
 */
export const deleteBusinessImageFromFirebase = async (imageUrl: string): Promise<void> => {
  try {
    if (!imageUrl || !imageUrl.includes('firebase')) {
      console.log('Not a Firebase Storage file, skipping:', imageUrl);
      return;
    }

    console.log('🗑️ Deleting business image from Firebase Storage:', imageUrl);
    
    // Extract file path from Firebase Storage URL
    const url = new URL(imageUrl);
    let filePath = url.pathname.match(/\/o\/(.+?)(\?|$)/)?.[1];
    
    if (filePath) {
      filePath = decodeURIComponent(filePath);
      console.log('🗑️ Deleting business file:', filePath);
      
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      
      console.log('✅ Business image deleted successfully:', filePath);
    } else {
      console.warn('Could not extract file path from URL:', imageUrl);
    }
  } catch (error) {
    console.error('❌ Error deleting business image from Firebase Storage:', error);
    throw error;
  }
};

/**
 * Delete a file from Firebase Storage
 */
export const deleteFileFromFirebaseStorage = async (fileUrl: string): Promise<void> => {
  try {
    if (!fileUrl || !fileUrl.includes('firebase')) {
      console.log('Not a Firebase Storage file, skipping:', fileUrl);
      return;
    }

    // Extract file path from Firebase Storage URL
    const url = new URL(fileUrl);
    let filePath = url.pathname.match(/\/o\/(.+?)(\?|$)/)?.[1];
    
    if (filePath) {
      filePath = decodeURIComponent(filePath);
      console.log('🗑️ Deleting file from Firebase Storage:', filePath);
      
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      
      console.log('✅ File deleted successfully:', filePath);
    } else {
      console.warn('Could not extract file path from URL:', fileUrl);
    }
  } catch (error) {
    console.error('❌ Error deleting file from Firebase Storage:', error);
    console.log('ℹ️ File may have already been deleted or never existed - continuing');
    // Don't throw error - event deletion should proceed
    return;
  }
};

/**
 * Smart media cleanup - only delete files when no other events use them
 */
const handleMediaCleanup = async (mediaUrl: string, deletedEventData: any): Promise<void> => {
  try {
    // Only handle compressed files or images (originals are already deleted by Cloud Functions)
    if (!mediaUrl.includes('_compressed') && 
        !mediaUrl.includes('.jpg') && 
        !mediaUrl.includes('.jpeg') && 
        !mediaUrl.includes('.png') &&
        !mediaUrl.includes('.webp')) {
      console.log('📎 Not a compressed file or image - skipping cleanup (original was already deleted by Cloud Function)');
      return;
    }
    
    console.log('🔍 Checking if any other events use this media:', mediaUrl);
    
    // Check if ANY other events (live or pending) use this same media URL
    const [liveEventsQuery, pendingEventsQuery] = await Promise.all([
      getDocs(query(
        collection(db, 'events'),
        where('image', '==', mediaUrl)
      )),
      getDocs(query(
        collection(db, 'events'),
        where('video', '==', mediaUrl)
      ))
    ]);
    
    // Also check pending events
    const [pendingImageQuery, pendingVideoQuery] = await Promise.all([
      getDocs(query(
        collection(db, 'pending-events'),
        where('image', '==', mediaUrl)
      )),
      getDocs(query(
        collection(db, 'pending-events'),
        where('video', '==', mediaUrl)
      ))
    ]);
    
    const totalUsage = liveEventsQuery.size + pendingEventsQuery.size + pendingImageQuery.size + pendingVideoQuery.size;
    
    if (totalUsage > 0) {
      console.log(`📎 Media file kept - ${totalUsage} other events still use this file:`, mediaUrl);
      return; // Don't delete - other events still use it
    }
    
    console.log('🗑️ No other events use this media - safe to delete:', mediaUrl);
    
    // Delete the media file since no other events use it
    await deleteFileFromFirebaseStorage(mediaUrl);
    console.log('✅ Media file deleted successfully');
    
  } catch (error) {
    console.error('❌ Error during media cleanup:', error);
    // Don't throw - event deletion succeeded even if media cleanup failed
  }
};

// ==========================================
// EVENT FUNCTIONS
// ==========================================

/**
 * Save event directly to Firebase (for admin dashboard)
 */
export const saveEventToFirebase = async (event: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    console.log('Saving event to Firebase:', event);
    const eventDoc = doc(db, 'events', event.id);
    
    const eventData = {
      businessId: event.businessId,
      title: event.title,
      caption: event.caption || null,
      date: event.date,
      link: event.link || null,
      tags: event.tags || [],
      image: event.image || null,
      video: event.video || null,
      recurringSeriesId: event.recurringSeriesId || null,
      recurringIndex: event.recurringIndex || null,
      totalRecurringEvents: event.totalRecurringEvents || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(eventDoc, eventData);
    console.log('✅ Event saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving event to Firebase:', error);
    throw error;
  }
};

/**
 * Delete event from Firebase with smart compressed file cleanup
 */
export const deleteEventFromFirebase = async (eventId: string): Promise<void> => {
  try {
    console.log('Deleting event from Firebase:', eventId);
    const eventDoc = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventDoc);
    
    if (!eventSnap.exists()) {
      throw new Error('Event not found');
    }
    
    const eventData = eventSnap.data();
    const mediaUrl = eventData.image || eventData.video;
    
    // Delete the event document first
    await deleteDoc(eventDoc);
    console.log('✅ Event document deleted from Firestore');
    
    // Handle compressed file cleanup (originals already deleted by Cloud Functions)
    if (mediaUrl) {
      await handleMediaCleanup(mediaUrl, eventData);
    }
    
    console.log('✅ Event deleted from Firebase successfully');
  } catch (error) {
    console.error('❌ Error deleting event from Firebase:', error);
    throw error;
  }
};

/**
 * Load events for a specific business
 */
export const loadEventsForBusiness = async (businessId: string): Promise<FirebaseEvent[]> => {
  try {
    console.log('Loading events for business:', businessId);
    const eventsQuery = query(
      collection(db, 'events'),
      where('businessId', '==', businessId)
    );
    
    const eventsSnap = await getDocs(eventsQuery);
    const events: FirebaseEvent[] = [];
    
    eventsSnap.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    console.log(`✅ Loaded ${events.length} events for business`);
    return events;
  } catch (error) {
    console.error('❌ Error loading events for business:', error);
    throw error;
  }
};

// ==========================================
// PENDING EVENTS FUNCTIONS
// ==========================================

/**
 * Save event to pending-events collection (waiting for video compression)
 */
export const savePendingEvent = async (eventData: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    console.log('Saving pending event to Firebase:', eventData.id);
    const eventDoc = doc(db, 'pending-events', eventData.id);
    
    const pendingEventData = {
      businessId: eventData.businessId,
      title: eventData.title,
      caption: eventData.caption || null,
      date: eventData.date,
      link: eventData.link || null,
      tags: eventData.tags || [],
      ...(eventData.image && { image: eventData.image }),
      ...(eventData.video && { video: eventData.video }),
      recurringSeriesId: eventData.recurringSeriesId || null,
      recurringIndex: eventData.recurringIndex || null,
      totalRecurringEvents: eventData.totalRecurringEvents || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(eventDoc, pendingEventData);
    console.log('✅ Pending event saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving pending event to Firebase:', error);
    throw error;
  }
};

/**
 * Load pending events for a specific business
 */
export const loadPendingEventsForBusiness = async (businessId: string): Promise<FirebaseEvent[]> => {
  try {
    console.log('Loading pending events for business:', businessId);
    const pendingEventsQuery = query(
      collection(db, 'pending-events'),
      where('businessId', '==', businessId)
    );
    
    const pendingEventsSnap = await getDocs(pendingEventsQuery);
    const pendingEvents: FirebaseEvent[] = [];
    
    pendingEventsSnap.forEach(doc => {
      pendingEvents.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    console.log(`✅ Loaded ${pendingEvents.length} pending events for business`);
    return pendingEvents;
  } catch (error) {
    console.error('❌ Error loading pending events for business:', error);
    throw error;
  }
};

/**
 * Delete event from pending-events collection
 */
export const deletePendingEvent = async (eventId: string): Promise<void> => {
  try {
    console.log('Deleting pending event from Firebase:', eventId);
    const eventDoc = doc(db, 'pending-events', eventId);
    
    await deleteDoc(eventDoc);
    console.log('✅ Pending event deleted from Firebase successfully');
  } catch (error) {
    console.error('❌ Error deleting pending event from Firebase:', error);
    throw error;
  }
};

/**
 * Move pending event to live events with compressed video URL
 */
export const movePendingEventToLive = async (eventId: string, compressedVideoUrl: string): Promise<void> => {
  try {
    console.log('Moving pending event to live:', eventId);
    
    // Get the pending event
    const pendingEventDoc = doc(db, 'pending-events', eventId);
    const pendingEventSnap = await getDoc(pendingEventDoc);
    
    if (!pendingEventSnap.exists()) {
      console.log('Pending event not found:', eventId);
      return;
    }
    
    const eventData = pendingEventSnap.data() as FirebaseEvent;
    
    // Update with compressed video URL
    const liveEventData = {
      ...eventData,
      video: compressedVideoUrl,
      updatedAt: new Date().toISOString()
    };
    
    // Save to events collection
    const liveEventDoc = doc(db, 'events', eventId);
    await setDoc(liveEventDoc, liveEventData);
    
    // Delete from pending-events
    await deleteDoc(pendingEventDoc);
    
    console.log('✅ Event moved from pending to live successfully');
  } catch (error) {
    console.error('❌ Error moving pending event to live:', error);
    throw error;
  }
};

/**
 * Save recurring pending events (for video processing)
 */
export const saveRecurringPendingEvents = async (events: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    events.forEach(event => {
      const eventDoc = doc(db, 'pending-events', event.id);
      batch.set(eventDoc, {
        ...event,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    await batch.commit();
    console.log('✅ Recurring pending events saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving recurring pending events to Firebase:', error);
    throw error;
  }
};

// ==========================================
// BUSINESS FUNCTIONS
// ==========================================

/**
 * Save business information to Firebase
 */
export const saveBusinessToFirebase = async (businessData: any, businessId: string): Promise<void> => {
  try {
    console.log('Saving business to Firebase:', businessId);
    const businessDoc = doc(db, 'businesses', businessId);
    
    const data: any = {
      name: businessData.name,
      address: businessData.address,
      description: businessData.description,
      website: businessData.website || null,
      tags: businessData.tags ? businessData.tags.split(',').map((tag: string) => tag.trim()) : [],
      socialLinks: businessData.socialLinks ? businessData.socialLinks.split(',').map((link: string) => link.trim()) : [],
      image: businessData.image || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(businessDoc, data);
    console.log('✅ Business saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving business to Firebase:', error);
    throw error;
  }
};

/**
 * Load business information from Firebase
 */
export const loadBusinessFromFirebase = async (businessId: string): Promise<FirebaseBusiness | null> => {
  try {
    console.log('Loading business from Firebase:', businessId);
    const businessDoc = doc(db, 'businesses', businessId);
    const businessSnap = await getDoc(businessDoc);
    
    if (businessSnap.exists()) {
      const business = { id: businessSnap.id, ...businessSnap.data() } as FirebaseBusiness;
      console.log('✅ Business loaded from Firebase successfully');
      return business;
    } else {
      console.log('No business found with ID:', businessId);
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading business from Firebase:', error);
    throw error;
  }
};

/**
 * Load all businesses from Firebase (for admin)
 */
export const loadBusinessesFromFirebase = async (): Promise<FirebaseBusiness[]> => {
  try {
    console.log('Loading all businesses from Firebase');
    const businessesQuery = query(collection(db, 'businesses'));
    const businessesSnap = await getDocs(businessesQuery);
    
    const businesses: FirebaseBusiness[] = [];
    businessesSnap.forEach(doc => {
      businesses.push({ id: doc.id, ...doc.data() } as FirebaseBusiness);
    });
    
    console.log(`✅ Loaded ${businesses.length} businesses from Firebase`);
    return businesses;
  } catch (error) {
    console.error('❌ Error loading businesses from Firebase:', error);
    throw error;
  }
};

/**
 * Load all events from Firebase (for admin)
 */
export const loadEventsFromFirebase = async (): Promise<FirebaseEvent[]> => {
  try {
    console.log('Loading all events from Firebase');
    const eventsQuery = query(collection(db, 'events'));
    const eventsSnap = await getDocs(eventsQuery);
    
    const events: FirebaseEvent[] = [];
    eventsSnap.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    console.log(`✅ Loaded ${events.length} events from Firebase`);
    return events;
  } catch (error) {
    console.error('❌ Error loading events from Firebase:', error);
    throw error;
  }
};

// ==========================================
// RECURRING EVENTS FUNCTIONS
// ==========================================

/**
 * Generate recurring event instances
 */
export const generateRecurringEvents = (
  baseEvent: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>, 
  recurrenceType: 'daily' | 'weekly' | 'custom',
  recurrenceCount?: number,
  customDates?: Date[]
): Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[] => {
  const events: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[] = [];

  if (recurrenceType === 'custom' && customDates) {
    // Custom dates
    customDates.forEach((date, index) => {
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_custom_${index}`,
        date: date.toISOString(),
        recurringSeriesId: baseEvent.id,
        recurringIndex: index,
        totalRecurringEvents: customDates.length,
      });
    });
  } else {
    // Daily/Weekly
    const baseDate = new Date(baseEvent.date);
    const count = recurrenceCount || 1;
    
    for (let i = 0; i < count; i++) {
      const eventDate = new Date(baseDate);
      
      if (recurrenceType === 'daily') {
        eventDate.setDate(baseDate.getDate() + i);
      } else if (recurrenceType === 'weekly') {
        eventDate.setDate(baseDate.getDate() + (i * 7));
      }
      
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_${i}`,
        date: eventDate.toISOString(),
        recurringSeriesId: baseEvent.id,
        recurringIndex: i,
        totalRecurringEvents: count,
      });
    }
  }
  
  return events;
};

/**
 * Save recurring events with shared media
 */
export const saveRecurringEventsToFirebase = async (events: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    events.forEach(event => {
      const eventDoc = doc(db, 'events', event.id);
      batch.set(eventDoc, {
        ...event,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    await batch.commit();
    console.log('✅ Recurring events saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving recurring events to Firebase:', error);
    throw error;
  }
};

// ==========================================
// LOAD EVENTS AND BUSINESSES COMBINED
// ==========================================

/**
 * Load events with business information for main app
 */
export const loadEventsAndBusinesses = async () => {
  try {
    console.log('Loading events and businesses from Firebase');
    
    const [eventsSnap, businessesSnap] = await Promise.all([
      getDocs(query(collection(db, 'events'))),
      getDocs(query(collection(db, 'businesses')))
    ]);
    
    const events: FirebaseEvent[] = [];
    const businesses: FirebaseBusiness[] = [];
    
    eventsSnap.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    businessesSnap.forEach(doc => {
      businesses.push({ id: doc.id, ...doc.data() } as FirebaseBusiness);
    });
    
    console.log(`✅ Loaded ${events.length} events and ${businesses.length} businesses`);
    return { events, businesses };
  } catch (error) {
    console.error('❌ Error loading events and businesses:', error);
    throw error;
  }
};

// ==========================================
// SMART CACHE IMPLEMENTATION
// ==========================================

interface BusinessCache {
  data: FirebaseBusiness[];
  lastCacheTime: number;
  lastUpdateTime: number;
}

interface EventCache {
  data: FirebaseEvent[];
  lastCacheTime: number;
  loadedUntilDate: string | null;
  isEmpty: boolean;
}

interface CacheMetrics {
  businessReads: number;
  eventReads: number;
  cacheHits: number;
  cacheMisses: number;
}

const CACHE_CONFIG = {
  BUSINESS_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  EVENT_CACHE_DURATION: 2 * 60 * 60 * 1000,     // 2 hours
  EVENTS_PER_CHUNK: 20,
  TARGET_DISPLAYABLE_EVENTS: 20,
  MAX_CHUNKS_PER_LOAD: 10,
};

let businessCache: BusinessCache | null = null;
let eventCache: EventCache | null = null;
let cacheMetrics: CacheMetrics = {
  businessReads: 0,
  eventReads: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

const isCacheValid = (lastCacheTime: number, duration: number): boolean => {
  return Date.now() - lastCacheTime < duration;
};

const getCurrentDateString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const addDays = (dateString: string, days: number): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const logCacheMetrics = (): void => {
  console.log('📊 Cache Performance:', {
    businessReads: cacheMetrics.businessReads,
    eventReads: cacheMetrics.eventReads,
    cacheHits: cacheMetrics.cacheHits,
    cacheMisses: cacheMetrics.cacheMisses,
    hitRate: `${((cacheMetrics.cacheHits / (cacheMetrics.cacheHits + cacheMetrics.cacheMisses)) * 100).toFixed(1)}%`
  });
};

export const clearAllCaches = (): void => {
  businessCache = null;
  eventCache = null;
  console.log('🗑️ All caches cleared');
};

const loadBusinessesCached = async (): Promise<FirebaseBusiness[]> => {
  const now = Date.now();

  if (businessCache && isCacheValid(businessCache.lastCacheTime, CACHE_CONFIG.BUSINESS_CACHE_DURATION)) {
    console.log('✅ Using cached businesses');
    cacheMetrics.cacheHits++;
    return businessCache.data;
  }

  console.log('🔄 Loading businesses from Firebase...');
  cacheMetrics.cacheMisses++;

  try {
    let businesses: FirebaseBusiness[] = [];

    if (businessCache && businessCache.lastUpdateTime) {
      console.log('📈 Performing incremental business update');
      
      const incrementalQuery = query(
        collection(db, 'businesses'),
        where('updatedAt', '>', new Date(businessCache.lastUpdateTime).toISOString()),
        orderBy('updatedAt', 'asc')
      );

      const incrementalSnap = await getDocs(incrementalQuery);
      cacheMetrics.businessReads += incrementalSnap.size;

      if (incrementalSnap.size > 0) {
        console.log(`📊 Found ${incrementalSnap.size} updated businesses`);
        
        businesses = [...businessCache.data];
        
        incrementalSnap.forEach(doc => {
          const updatedBusiness = { id: doc.id, ...doc.data() } as FirebaseBusiness;
          const existingIndex = businesses.findIndex(b => b.id === updatedBusiness.id);
          
          if (existingIndex >= 0) {
            businesses[existingIndex] = updatedBusiness;
          } else {
            businesses.push(updatedBusiness);
          }
        });
      } else {
        console.log('📊 No business updates found, using existing cache');
        businesses = businessCache.data;
      }
    } else {
      console.log('📊 Performing full business load');
      
      const fullQuery = query(collection(db, 'businesses'));
      const fullSnap = await getDocs(fullQuery);
      cacheMetrics.businessReads += fullSnap.size;

      fullSnap.forEach(doc => {
        businesses.push({ id: doc.id, ...doc.data() } as FirebaseBusiness);
      });
    }

    businessCache = {
      data: businesses,
      lastCacheTime: now,
      lastUpdateTime: now,
    };

    console.log(`✅ Cached ${businesses.length} businesses`);
    return businesses;

  } catch (error) {
    console.error('❌ Error loading businesses:', error);
    
    if (businessCache) {
      console.log('⚠️ Using stale business cache due to error');
      return businessCache.data;
    }
    
    throw error;
  }
};

const findNextEventDate = async (startDate: string): Promise<string | null> => {
  try {
    const nextEventQuery = query(
      collection(db, 'events'),
      where('date', '>=', startDate),
      orderBy('date', 'asc'),
      limit(1)
    );

    const nextEventSnap = await getDocs(nextEventQuery);
    cacheMetrics.eventReads += 1;

    if (nextEventSnap.empty) {
      return null;
    }

    const nextEvent = nextEventSnap.docs[0].data();
    return nextEvent.date.split('T')[0];
  } catch (error) {
    console.error('❌ Error finding next event date:', error);
    return null;
  }
};

const loadEventsForDateRange = async (startDate: string, endDate: string): Promise<FirebaseEvent[]> => {
  try {
    const eventsQuery = query(
      collection(db, 'events'),
      where('date', '>=', startDate),
      where('date', '<', endDate),
      orderBy('date', 'asc')
    );

    const eventsSnap = await getDocs(eventsQuery);
    cacheMetrics.eventReads += eventsSnap.size;

    const events: FirebaseEvent[] = [];
    eventsSnap.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });

    return events;
  } catch (error) {
    console.error('❌ Error loading events for date range:', error);
    return [];
  }
};

const loadEventsProgressive = async (
  startDate: string,
  targetCount: number = CACHE_CONFIG.TARGET_DISPLAYABLE_EVENTS
): Promise<{ events: FirebaseEvent[], loadedUntilDate: string }> => {
  console.log(`🔄 Loading events progressively from ${startDate}, target: ${targetCount}`);
  
  let allEvents: FirebaseEvent[] = [];
  let currentDate = startDate;
  let chunksLoaded = 0;
  let loadedUntilDate = startDate;

  while (allEvents.length < targetCount && chunksLoaded < CACHE_CONFIG.MAX_CHUNKS_PER_LOAD) {
    const nextEventDate = await findNextEventDate(currentDate);
    
    if (!nextEventDate) {
      console.log('📊 No more events found');
      break;
    }

    const daysSkipped = Math.floor(
      (new Date(nextEventDate).getTime() - new Date(currentDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSkipped > 0) {
      console.log(`⏭️ Skipped ${daysSkipped} empty days`);
    }

    const chunkEndDate = addDays(nextEventDate, 1);
    const chunkEvents = await loadEventsForDateRange(nextEventDate, chunkEndDate);
    
    allEvents = [...allEvents, ...chunkEvents];
    loadedUntilDate = chunkEndDate;
    chunksLoaded++;
    
    console.log(`📊 Loaded chunk ${chunksLoaded}: ${chunkEvents.length} events (total: ${allEvents.length})`);
    
    currentDate = chunkEndDate;
  }

  console.log(`✅ Progressive loading complete: ${allEvents.length} events, ${chunksLoaded} chunks`);
  
  return { events: allEvents, loadedUntilDate };
};

const loadEventsCached = async (): Promise<FirebaseEvent[]> => {
  const now = Date.now();
  const todayString = getCurrentDateString();

  if (eventCache && isCacheValid(eventCache.lastCacheTime, CACHE_CONFIG.EVENT_CACHE_DURATION)) {
    console.log('✅ Using cached events');
    cacheMetrics.cacheHits++;
    return eventCache.data;
  }

  console.log('🔄 Loading events from Firebase...');
  cacheMetrics.cacheMisses++;

  try {
    const { events, loadedUntilDate } = await loadEventsProgressive(todayString);

    eventCache = {
      data: events,
      lastCacheTime: now,
      loadedUntilDate,
      isEmpty: events.length === 0,
    };

    console.log(`✅ Cached ${events.length} events (loaded until ${loadedUntilDate})`);
    return events;

  } catch (error) {
    console.error('❌ Error loading events:', error);
    
    if (eventCache) {
      console.log('⚠️ Using stale event cache due to error');
      return eventCache.data;
    }
    
    throw error;
  }
};

const extendEventCache = async (additionalCount: number = CACHE_CONFIG.TARGET_DISPLAYABLE_EVENTS): Promise<FirebaseEvent[]> => {
  if (!eventCache || !eventCache.loadedUntilDate) {
    console.log('⚠️ No existing cache to extend, performing full load');
    return loadEventsCached();
  }

  console.log(`🔄 Extending event cache by ${additionalCount} events`);

  try {
    const { events: newEvents, loadedUntilDate } = await loadEventsProgressive(
      eventCache.loadedUntilDate,
      additionalCount
    );

    const allEvents = [...eventCache.data, ...newEvents];

    eventCache = {
      ...eventCache,
      data: allEvents,
      loadedUntilDate,
      lastCacheTime: Date.now(),
    };

    console.log(`✅ Extended cache: ${newEvents.length} new events (total: ${allEvents.length})`);
    return allEvents;

  } catch (error) {
    console.error('❌ Error extending event cache:', error);
    return eventCache.data;
  }
};

const shouldBypassCache = (
  forcedDate?: string,
  startDate?: string,
  endDate?: string,
  businessId?: string
): boolean => {
  if (forcedDate || startDate || endDate || businessId) {
    console.log('🔀 Bypassing cache for specific query');
    return true;
  }
  
  return false;
};

export const loadEventsAndBusinessesCached = async (options: {
  forcedDate?: string;
  startDate?: string;
  endDate?: string;
  businessId?: string;
} = {}) => {
  const { forcedDate, startDate, endDate, businessId } = options;
  
  console.log('🚀 Loading events and businesses with smart cache...');
  const startTime = Date.now();

  try {
    if (shouldBypassCache(forcedDate, startDate, endDate, businessId)) {
      return await loadEventsAndBusinesses();
    }

    const [events, businesses] = await Promise.all([
      loadEventsCached(),
      loadBusinessesCached()
    ]);

    const loadTime = Date.now() - startTime;
    console.log(`✅ Smart cache load complete: ${events.length} events, ${businesses.length} businesses (${loadTime}ms)`);
    
    logCacheMetrics();

    return { events, businesses };

  } catch (error) {
    console.error('❌ Error in smart cache load:', error);
    
    console.log('🔄 Falling back to direct Firebase load');
    return await loadEventsAndBusinesses();
  }
};

export const loadMoreEventsCached = async (): Promise<FirebaseEvent[]> => {
  console.log('🔄 Loading more events with cache extension...');
  
  try {
    return await extendEventCache();
  } catch (error) {
    console.error('❌ Error loading more cached events:', error);
    
    if (eventCache) {
      return eventCache.data;
    }
    
    throw error;
  }
};

export const refreshAllCaches = async () => {
  console.log('🔄 Force refreshing all caches...');
  
  clearAllCaches();
  
  cacheMetrics = {
    businessReads: 0,
    eventReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  
  return await loadEventsAndBusinessesCached();
};

export const getCacheStatus = () => {
  return {
    businessCache: {
      exists: !!businessCache,
      itemCount: businessCache?.data.length || 0,
      lastCacheTime: businessCache?.lastCacheTime || 0,
      isValid: businessCache ? isCacheValid(businessCache.lastCacheTime, CACHE_CONFIG.BUSINESS_CACHE_DURATION) : false,
    },
    eventCache: {
      exists: !!eventCache,
      itemCount: eventCache?.data.length || 0,
      lastCacheTime: eventCache?.lastCacheTime || 0,
      loadedUntilDate: eventCache?.loadedUntilDate || null,
      isValid: eventCache ? isCacheValid(eventCache.lastCacheTime, CACHE_CONFIG.EVENT_CACHE_DURATION) : false,
    },
    metrics: { ...cacheMetrics },
  };
};

/**
 * Check for new events with minimal reads
 * Only does Firebase reads when new events actually exist
 */
export const checkForNewEventsLightweight = async (): Promise<boolean> => {
  console.log('🔄 Checking for new events (lightweight)...');
  
  try {
    if (!eventCache || eventCache.data.length === 0) {
      console.log('📊 No event cache exists, need full load');
      await loadEventsCached();
      return true;
    }
    
    // Get the most recent event date from our cache
    const sortedCacheEvents = [...eventCache.data].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    const mostRecentCacheDate = sortedCacheEvents[0]?.date || getCurrentDateString();
    console.log(`📊 Most recent cached event: ${mostRecentCacheDate}`);
    
    // Check if there are ANY events newer than our most recent cached event
    // This is just 1 Firebase read to check existence
    const newEventsCheckQuery = query(
      collection(db, 'events'),
      where('date', '>', mostRecentCacheDate),
      limit(1) // Just check if ANY newer events exist
    );
    
    const newEventsCheckSnap = await getDocs(newEventsCheckQuery);
    cacheMetrics.eventReads += 1; // Always 1 read for the existence check
    
    if (newEventsCheckSnap.empty) {
      console.log('✅ No new events found - cache is current');
      return false; // No new events, total cost: 1 read
    }
    
    console.log('📊 New events detected! Loading them...');
    
    // Only if new events exist, do we load them
    // Get all events newer than our cache
    const newEventsQuery = query(
      collection(db, 'events'),
      where('date', '>', mostRecentCacheDate),
      orderBy('date', 'asc')
    );
    
    const newEventsSnap = await getDocs(newEventsQuery);
    cacheMetrics.eventReads += newEventsSnap.size;
    
    const newEvents: FirebaseEvent[] = [];
    newEventsSnap.forEach(doc => {
      newEvents.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    // Add new events to existing cache
    const updatedEvents = [...eventCache.data, ...newEvents];
    
    // Update cache with new events
    eventCache = {
      ...eventCache,
      data: updatedEvents,
      lastCacheTime: Date.now(),
    };
    
    console.log(`✅ Added ${newEvents.length} new events to cache`);
    return true; // New events found and loaded
    
  } catch (error) {
    console.error('❌ Error checking for new events:', error);
    return false;
  }
};

/**
 * Check for updated existing events (events that changed)
 * Only useful if you have events that get edited after creation
 */
export const checkForUpdatedEvents = async (): Promise<boolean> => {
  console.log('🔄 Checking for updated events...');
  
  try {
    if (!eventCache || eventCache.data.length === 0) {
      return false;
    }
    
    // Get the most recent update time from our cache
    const mostRecentUpdate = Math.max(
      ...eventCache.data.map(event => new Date(event.updatedAt || event.createdAt).getTime())
    );
    
    const recentUpdateTime = new Date(mostRecentUpdate).toISOString();
    console.log(`📊 Checking for events updated after: ${recentUpdateTime}`);
    
    // Check for events updated since our most recent cache update
    const updatedEventsQuery = query(
      collection(db, 'events'),
      where('updatedAt', '>', recentUpdateTime),
      limit(5) // Only check recent updates
    );
    
    const updatedEventsSnap = await getDocs(updatedEventsQuery);
    cacheMetrics.eventReads += updatedEventsSnap.size;
    
    if (updatedEventsSnap.empty) {
      console.log('✅ No updated events found');
      return false;
    }
    
    console.log(`📊 Found ${updatedEventsSnap.size} updated events`);
    
    // Update the cached events with new data
    let hasUpdates = false;
    const updatedCacheData = [...eventCache.data];
    
    updatedEventsSnap.forEach(doc => {
      const updatedEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
      const existingIndex = updatedCacheData.findIndex(e => e.id === updatedEvent.id);
      
      if (existingIndex >= 0) {
        updatedCacheData[existingIndex] = updatedEvent;
        hasUpdates = true;
      }
    });
    
    if (hasUpdates) {
      eventCache = {
        ...eventCache,
        data: updatedCacheData,
        lastCacheTime: Date.now(),
      };
      
      console.log('✅ Updated existing events in cache');
    }
    
    return hasUpdates;
    
  } catch (error) {
    console.error('❌ Error checking for updated events:', error);
    return false;
  }
};

/**
 * Complete lightweight refresh for pull-to-refresh
 * Combines new events + updated events check
 */
export const lightweightRefresh = async (): Promise<boolean> => {
  console.log('🔄 Starting lightweight refresh...');
  
  const startReads = cacheMetrics.eventReads;
  
  try {
    // Check for new events (always 1 read minimum)
    const hasNewEvents = await checkForNewEventsLightweight();
    
    // Check for updated events (only if you need this feature)
    // const hasUpdatedEvents = await checkForUpdatedEvents();
    
    const totalReads = cacheMetrics.eventReads - startReads;
    const hasChanges = hasNewEvents; // || hasUpdatedEvents;
    
    if (hasChanges) {
      console.log(`✅ Lightweight refresh complete: found updates (${totalReads} reads)`);
    } else {
      console.log(`✅ Lightweight refresh complete: no updates (${totalReads} reads)`);
    }
    
    return hasChanges;
    
  } catch (error) {
    console.error('❌ Error in lightweight refresh:', error);
    return false;
  }
};

// Alias for backward compatibility and clearer naming in component
export const forceRefreshAllCaches = refreshAllCaches;