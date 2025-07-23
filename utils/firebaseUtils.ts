// utils/firebaseUtils.ts - Updated with smart media cleanup

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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
 * Upload file to Firebase Storage
 */
export const uploadToFirebaseStorage = async (uri: string, filename: string): Promise<string> => {
  try {
    console.log('Uploading file to Firebase Storage:', { uri, filename });
    
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, `events/${filename}`);
    
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
 * Smart media cleanup - only delete COMPRESSED files when no other events use them
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
    
    // Check if this is part of a recurring series
    if (deletedEventData.recurringSeriesId) {
      // Check if any other events in the series still exist
      const seriesQuery = query(
        collection(db, 'events'),
        where('recurringSeriesId', '==', deletedEventData.recurringSeriesId)
      );
      
      const seriesSnap = await getDocs(seriesQuery);
      
      if (!seriesSnap.empty) {
        console.log(`📎 Compressed file kept - ${seriesSnap.size} other events in series still exist`);
        return; // Don't delete compressed file - other events still use it
      }
      
      console.log('🗑️ Last event in series deleted - cleaning up compressed file');
    }
    
    // Delete the compressed file (originals were already cleaned up by Cloud Functions)
    await deleteFileFromFirebaseStorage(mediaUrl);
    console.log('✅ Compressed file deleted successfully');
    
  } catch (error) {
    console.error('❌ Error during compressed file cleanup:', error);
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

// ==========================================
// RECURRING EVENTS FUNCTIONS
// ==========================================

/**
 * Generate recurring event instances
 */
export const generateRecurringEvents = (baseEvent: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>, recurrenceData: {
  type: 'daily' | 'weekly' | 'custom';
  count?: number;
  customDates?: Date[];
}): Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[] => {
  const events: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'>[] = [];

  if (recurrenceData.type === 'custom' && recurrenceData.customDates) {
    // Custom dates
    recurrenceData.customDates.forEach((date, index) => {
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_custom_${index}`,
        date: date.toISOString(),
        recurringSeriesId: baseEvent.id,
        recurringIndex: index,
        totalRecurringEvents: recurrenceData.customDates!.length,
      });
    });
  } else {
    // Daily/Weekly
    const baseDate = new Date(baseEvent.date);
    const count = recurrenceData.count || 1;
    
    for (let i = 0; i < count; i++) {
      const eventDate = new Date(baseDate);
      
      if (recurrenceData.type === 'daily') {
        eventDate.setDate(baseDate.getDate() + i);
      } else if (recurrenceData.type === 'weekly') {
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
      updatedAt: new Date().toISOString()
    };
    
    const existingDoc = await getDoc(businessDoc);
    if (!existingDoc.exists()) {
      data.createdAt = new Date().toISOString();
    }
    
    await setDoc(businessDoc, data, { merge: true });
    console.log('✅ Business saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving business to Firebase:', error);
    throw error;
  }
};

/**
 * Load business data from Firebase
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

// ==========================================
// COMBINED LOAD FUNCTIONS
// ==========================================

/**
 * Load events and businesses from Firebase (for main app)
 */
export const loadEventsAndBusinesses = async (): Promise<{
  events: FirebaseEvent[];
  businesses: FirebaseBusiness[];
}> => {
  try {
    console.log('Loading events and businesses from Firebase...');
    
    const [eventsSnap, businessesSnap] = await Promise.all([
      getDocs(collection(db, 'events')),
      getDocs(collection(db, 'businesses'))
    ]);
    
    const events: FirebaseEvent[] = [];
    eventsSnap.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() } as FirebaseEvent);
    });
    
    const businesses: FirebaseBusiness[] = [];
    businessesSnap.forEach(doc => {
      businesses.push({ id: doc.id, ...doc.data() } as FirebaseBusiness);
    });
    
    console.log(`✅ Loaded ${events.length} events and ${businesses.length} businesses from Firebase`);
    return { events, businesses };
  } catch (error) {
    console.error('❌ Error loading events and businesses from Firebase:', error);
    throw new Error('Please check your internet connection.');
  }
};