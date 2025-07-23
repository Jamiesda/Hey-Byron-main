// app/admin/dashboard.tsx - Updated with recurring events and fixed undefined values
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

// Import extracted constants and utilities
import { isImage, isVideo } from '../../constants/fileConfig';
import { validateBusinessData, validateEventData } from '../../constants/validation';
import { getErrorMessage } from '../../utils/errorHandling';

// Import Firebase functions
import {
  FirebaseEvent,
  deleteEventFromFirebase,
  deletePendingEvent,
  generateRecurringEvents,
  loadBusinessFromFirebase,
  loadEventsForBusiness,
  loadPendingEventsForBusiness,
  saveBusinessToFirebase,
  saveEventToFirebase,
  savePendingEvent,
  saveRecurringEventsToFirebase,
  uploadToFirebaseStorage
} from '../../utils/firebaseUtils';

// Import main components
import { BusinessForm, BusinessFormData } from '../../components/business';
import { EventForm, EventFormData, EventsList, UploadState } from '../../components/events';

// Firebase imports

const backgroundPattern = require('../../assets/logo3.png');
const heyByronBlackLogo = require('../../assets/hey.byronblack.png');

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);

  // Business state
  const [businessData, setBusinessData] = useState<BusinessFormData>({
    name: '',
    address: '',
    description: '',
    tags: '',
    website: '',
    socialLinks: '',
  });
  const [savingBiz, setSavingBiz] = useState(false);

  // Event state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventData, setEventData] = useState<EventFormData>({
    title: '',
    caption: '',
    link: '',
    interests: [],
    date: new Date(),
    isRecurring: false,
    recurrenceType: undefined,
    recurrenceCount: undefined,
    customDates: [],
  });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    isComplete: true
  });

  // Events data
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<FirebaseEvent[]>([]);

  useEffect(() => {
    checkBusinessAccess();
  }, []);

  const checkBusinessAccess = async () => {
    try {
      const businessCode = await AsyncStorage.getItem('businessCode');
      const isBusiness = await AsyncStorage.getItem('isBusiness');
      
      if (!businessCode || !isBusiness) {
        router.replace('/admin/login');
        return;
      }
      
      setCode(businessCode);
      await loadData(businessCode);
    } catch (error) {
      console.error('Error checking business access:', error);
      router.replace('/admin/login');
    }
  };

  const loadData = async (businessCode: string) => {
    try {
      setLoading(true);
      
      // Load business data
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

      // Load events and pending events
      const [eventsData, pendingEventsData] = await Promise.all([
        loadEventsForBusiness(businessCode),
        loadPendingEventsForBusiness(businessCode)
      ]);

      setEvents(eventsData);
      setPendingEvents(pendingEventsData);
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Business functions
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

  // Event functions
  const handleEventDataChange = (data: Partial<EventFormData>) => {
    setEventData(prev => ({ ...prev, ...data }));
  };

  const handleEventMediaSelected = async () => {
    // This will trigger the existing pickEventImage logic
    // For now, we'll use a simplified version
    try {
      setUploadState(prev => ({ ...prev, isUploading: true, isComplete: false, error: null }));
      // The actual media selection and upload logic would go here
      // This is simplified for the refactor
    } catch (error) {
      console.error('Error selecting event media:', error);
      setUploadState(prev => ({ ...prev, error: 'Failed to upload media' }));
    }
  };

  const handleUploadStateChange = (newState: Partial<UploadState>) => {
    setUploadState(prev => ({ ...prev, ...newState }));
  };

  const saveEvent = async () => {
    try {
      setSavingEvent(true);

      // Validate event data
      const errors = validateEventData({
        title: eventData.title,
        caption: eventData.caption,
        date: eventData.date,
        link: eventData.link,
        interests: eventData.interests,
        isRecurring: eventData.isRecurring,
        recurrenceType: eventData.recurrenceType,
        recurrenceCount: eventData.recurrenceCount,
        customDates: eventData.customDates,
      });

      if (errors.length > 0) {
        Alert.alert('Validation Error', errors.join('\n'));
        return;
      }

      // Create clean event object (NO undefined values for Firebase)
      const baseEvent: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'> = {
        id: editingEventId || `${code}_${Date.now()}`,
        businessId: code!,
        title: eventData.title.trim(),
        caption: eventData.caption.trim() || '', // Empty string instead of undefined
        date: eventData.date.toISOString(),
        link: eventData.link.trim(), // Now mandatory, so always has value
        tags: eventData.interests,
        // Only include image/video if they exist, otherwise exclude entirely
        ...(eventData.image && isImage(eventData.image) && { image: eventData.image }),
        ...(eventData.image && isVideo(eventData.image) && { video: eventData.image }),
      };

      // Handle recurring events
      if (eventData.isRecurring && eventData.recurrenceType) {
        let recurringEvents;
        
        if (eventData.recurrenceType === 'custom' && eventData.customDates) {
          recurringEvents = generateRecurringEvents(baseEvent, {
            type: 'custom',
            customDates: eventData.customDates
          });
          
          await saveRecurringEventsToFirebase(recurringEvents);
          Alert.alert('Success', `${eventData.customDates.length} custom events created successfully!`);
          
        } else if (eventData.recurrenceCount) {
          recurringEvents = generateRecurringEvents(baseEvent, {
            type: eventData.recurrenceType,
            count: eventData.recurrenceCount
          });
          
          await saveRecurringEventsToFirebase(recurringEvents);
          Alert.alert('Success', `${eventData.recurrenceCount} ${eventData.recurrenceType} events created successfully!`);
        }
      } else {
        // Single event
        if (eventData.image && isVideo(eventData.image)) {
          await savePendingEvent(baseEvent);
        } else {
          await saveEventToFirebase(baseEvent);
        }
        Alert.alert('Success', 'Event saved successfully!');
      }

      // Reload data and reset form
      await loadData(code!);
      resetEventForm();

    } catch (error) {
      console.error('Error saving event:', error);
      const errorMsg = getErrorMessage(error, 'save event');
      Alert.alert('Save Failed', errorMsg);
    } finally {
      setSavingEvent(false);
    }
  };

  const resetEventForm = () => {
    setEventData({
      title: '',
      caption: '',
      link: '',
      interests: [],
      date: new Date(),
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceCount: undefined,
      customDates: [],
    });
    setEditingEventId(null);
    setShowEventForm(false);
    setUploadState({ 
      isUploading: false, 
      progress: 0, 
      error: null, 
      isComplete: true 
    });
  };

  // Event management functions
  const handleEditEvent = (event: FirebaseEvent) => {
    setEventData({
      title: event.title,
      caption: event.caption || '',
      link: event.link || '',
      interests: event.tags || [],
      date: new Date(event.date),
      image: event.image || event.video,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceCount: undefined,
      customDates: [],
    });
    setEditingEventId(event.id);
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventFromFirebase(eventId);
              await loadData(code!);
              Alert.alert('Success', 'Event deleted successfully');
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  const handleDeletePendingEvent = async (eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePendingEvent(eventId);
              await loadData(code!);
              Alert.alert('Success', 'Event deleted successfully');
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ImageBackground 
      source={backgroundPattern} 
      style={styles.background}
      resizeMode="repeat"
    >
      <LinearGradient 
        colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.95)']} 
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safe}>
        {/* Logo Button */}
        <TouchableOpacity style={styles.logoButton} onPress={() => router.replace('/')}>
          <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Business Form */}
            <BusinessForm
              businessData={businessData}
              onSave={saveBusiness}
              loading={savingBiz}
              onDataChange={handleBusinessDataChange}
              onImageSelected={handleBusinessImageSelected}
              onImageDeleted={() => {
                console.log('Business image deleted');
              }}
            />

            {/* Events Section */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Your Events</Text>
                <TouchableOpacity
                  style={styles.addEventButton}
                  onPress={() => {
                    if (showEventForm) {
                      resetEventForm();
                    } else {
                      setShowEventForm(true);
                    }
                  }}
                >
                  <Text style={styles.addEventButtonText}>
                    {showEventForm ? 'Cancel' : '+ Add Event'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Event Form */}
              {showEventForm && (
                <EventForm
                  eventData={eventData}
                  onSave={saveEvent}
                  onCancel={resetEventForm}
                  loading={savingEvent}
                  uploadState={uploadState}
                  onUploadStateChange={handleUploadStateChange}
                  onDataChange={handleEventDataChange}
                  onMediaSelected={handleEventMediaSelected}
                  editingMode={!!editingEventId}
                />
              )}

              {/* Events List */}
              <EventsList
                events={events}
                pendingEvents={pendingEvents}
                onEdit={handleEditEvent}
                onDelete={handleDeleteEvent}
                onDeletePending={handleDeletePendingEvent}
              />
            </View>
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
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? 16 : 0,
  },
  logoButton: {
    position: 'absolute',
    left: 20,  // Changed from right to left
    top: Platform.OS === 'ios' ? 60 : 40,
    padding: 8,
    zIndex: 10,
  },
  logoImage: {
    width: 150,  // Changed from 120 to 150
    height: 24,  // Changed from 20 to 24
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    marginTop: 50,  // Increased from 40 to 100 to account for logo height
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 40,  // Reduced from 120 to 40 to move content higher
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  addEventButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addEventButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});