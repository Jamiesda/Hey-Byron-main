// app/admin/events-dashboard.tsx
// Complete updated version with hybrid filename processing and enhanced user messaging
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
import { isImage, isVideo } from '../../constants/fileConfig';
import { validateEventData } from '../../constants/validation';
import { getErrorMessage } from '../../utils/errorHandling';

// Import Firebase functions
import {
    FirebaseEvent,
    deleteEventFromFirebase,
    deletePendingEvent,
    generateRecurringEvents,
    loadEventsForBusiness,
    loadPendingEventsForBusiness,
    saveEventToFirebase,
    savePendingEvent,
    saveRecurringEventsToFirebase,
    uploadToFirebaseStorage
} from '../../utils/firebaseUtils';

// Import components
import { EventForm, EventFormData, EventsList, UploadState } from '../../components/events';

const backgroundPattern = require('../../assets/background.png');
const heyByronBlackLogo = require('../../assets/heybyronhorizontallogo.png');

export default function EventsDashboard() {
  const router = useRouter();
  
  // Basic state
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Events state
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<FirebaseEvent[]>([]);
  const [eventData, setEventData] = useState<EventFormData>({
    title: '',
    caption: '',
    link: '',
    interests: [],
    date: new Date(),
    image: undefined,
    isRecurring: false,
    recurrenceType: undefined,
    recurrenceCount: undefined,
    customDates: [],
  });
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    isComplete: false,
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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
      await loadEventsData(businessCode);
    } catch (error) {
      console.error('Error checking business access:', error);
      router.replace('/admin/login');
    }
  };

  const loadEventsData = async (businessCode: string) => {
    try {
      setLoading(true);
      
      const [eventsData, pendingEventsData] = await Promise.all([
        loadEventsForBusiness(businessCode),
        loadPendingEventsForBusiness(businessCode)
      ]);

      setEvents(eventsData);
      setPendingEvents(pendingEventsData);
      
    } catch (error) {
      console.error('Error loading events data:', error);
      Alert.alert('Error', 'Failed to load events data');
    } finally {
      setLoading(false);
    }
  };

  // Event form handlers
  const handleEventDataChange = (data: Partial<EventFormData>) => {
    setEventData(prev => ({ ...prev, ...data }));
  };

  const handleEventMediaSelected = async () => {
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

      // Generate consistent eventId upfront
      const eventId = editingEventId || `${code}_${Date.now()}`;
      console.log('📝 Saving event with ID:', eventId);

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

      // Handle media upload with eventId for hybrid filename
      let finalMediaUrl = eventData.image;
      if (eventData.image && !eventData.image.startsWith('http')) {
        // This is a local file that needs uploading
        console.log('📤 Uploading media with eventId for reliable processing');
        
        const ext = eventData.image.split('.').pop() || 'file';
        const baseFilename = `event_${Date.now()}.${ext}`;
        
        // Use the enhanced upload function with eventId for hybrid filename
        finalMediaUrl = await uploadToFirebaseStorage(eventData.image, baseFilename, eventId);
        console.log('✅ Media uploaded with hybrid filename');
      }

      // Create clean event object (NO undefined values for Firebase)
      const baseEvent: Omit<FirebaseEvent, 'createdAt' | 'updatedAt'> = {
        id: eventId,
        businessId: code!,
        title: eventData.title.trim(),
        caption: eventData.caption.trim() || '',
        date: eventData.date.toISOString(),
        link: eventData.link.trim(),
        tags: eventData.interests,
        ...(finalMediaUrl && isImage(finalMediaUrl) && { image: finalMediaUrl }),
        ...(finalMediaUrl && isVideo(finalMediaUrl) && { video: finalMediaUrl }),
      };

      // Handle recurring events
      if (eventData.isRecurring && !editingEventId) {
        const recurringEvents = await generateRecurringEvents(
          baseEvent,
          eventData.recurrenceType!,
          eventData.recurrenceCount,
          eventData.customDates
        );

        if (recurringEvents.length > 0) {
          const hasFutureEvents = recurringEvents.some(e => new Date(e.date) > new Date());
          
          if (hasFutureEvents) {
            // Save to pending events for server processing
            await saveRecurringEventsToFirebase(recurringEvents);
            
            // Show the enhanced user message
            Alert.alert(
              '✅ Event Saved Successfully!',
              '📽️ Your events are being processed and will go live when ready. You may close the app - we\'ll handle the rest!'
            );
          } else {
            Alert.alert('Error', 'All recurring event dates are in the past');
            return;
          }
        }
      } else {
        // Single event
        const isFuture = new Date(baseEvent.date) > new Date();
        
        if (editingEventId) {
          // Update existing event
          await saveEventToFirebase(baseEvent);
          Alert.alert('Success', 'Event updated successfully!');
        } else if (isFuture) {
          // Save to pending events for processing
          await savePendingEvent(baseEvent);
          
          // Show the enhanced user message
          Alert.alert(
            '✅ Event Saved Successfully!',
            '📽️ Your event is being processed and will go live when ready. You may close the app - we\'ll handle the rest!'
          );
        } else {
          Alert.alert('Error', 'Cannot create events in the past');
          return;
        }
      }

      // Reset form and reload data
      resetEventForm();
      await loadEventsData(code!);

    } catch (error) {
      console.error('Error saving event:', error);
      const errorMsg = getErrorMessage(error, 'save event');
      Alert.alert('Save Failed', errorMsg);
    } finally {
      setSavingEvent(false);
    }
  };

  const editEvent = (event: FirebaseEvent) => {
    setEventData({
      title: event.title,
      caption: event.caption || '',
      link: event.link || '',
      interests: event.tags,
      date: new Date(event.date),
      image: event.image || event.video,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceCount: undefined,
      customDates: [],
    });
    setEditingEventId(event.id);
  };

  const deleteEvent = async (eventId: string) => {
    // Add validation to ensure eventId exists
    if (!eventId) {
      console.error('No event ID provided for deletion');
      Alert.alert('Error', 'Cannot delete event: No event ID found');
      return;
    }

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
              console.log('Deleting event with ID:', eventId);
              await deleteEventFromFirebase(eventId);
              await loadEventsData(code!);
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

  const deletePendingEventAction = async (eventId: string) => {
    // Add validation to ensure eventId exists
    if (!eventId) {
      console.error('No event ID provided for deletion');
      Alert.alert('Error', 'Cannot delete event: No event ID found');
      return;
    }

    Alert.alert(
      'Delete Pending Event',
      'Are you sure you want to delete this pending event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting pending event with ID:', eventId);
              await deletePendingEvent(eventId);
              await loadEventsData(code!);
              Alert.alert('Success', 'Pending event deleted successfully');
            } catch (error) {
              console.error('Error deleting pending event:', error);
              Alert.alert('Error', 'Failed to delete pending event');
            }
          }
        }
      ]
    );
  };

  const resetEventForm = () => {
    setEventData({
      title: '',
      caption: '',
      link: '',
      interests: [],
      date: new Date(),
      image: undefined,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceCount: undefined,
      customDates: [],
    });
    setEditingEventId(null);
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      isComplete: false,
    });
  };

  const navigateToBusiness = () => {
    router.push('/admin/business-dashboard');
  };

  const navigateBack = () => {
    router.push('/admin/dashboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
      <LinearGradient 
        colors={[
          'rgb(16, 78, 78)', 
          'rgb(30, 120, 120)'
        ]} 
        style={styles.overlay}
      >
        <SafeAreaView style={styles.container}>
          
          {/* Logo Button */}
          <TouchableOpacity
            style={styles.logoButton}
            onPress={navigateBack}
          >
            <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
          </TouchableOpacity>

          <KeyboardAvoidingView 
            style={styles.content} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              
              {/* Event Form */}
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

              {/* Events List */}
              <EventsList
                events={events}
                pendingEvents={pendingEvents}
                onEdit={editEvent}
                onDelete={deleteEvent}
                onDeletePending={deletePendingEventAction}
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
  logoButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 60 : 40,
    padding: 8,
    zIndex: 10,
  },
  logoImage: {
    width: 150,
    height: 24,
  },
  content: {
    flex: 1,
    marginTop: 100, // Space for logo
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});