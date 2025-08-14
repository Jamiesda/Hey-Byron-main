// app/admin/events-dashboard.tsx - Updated with your requested changes
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
import { getErrorMessage } from '../../utils/ErrorHandling';

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
    saveRecurringPendingEvents, // ✅ ADDED THIS LINE
    uploadToFirebaseStorage
} from '../../utils/firebaseUtils';

// Import components
import { EventForm, EventFormData, UploadState } from '../../components/events';

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
            // ✅ FIXED: Check if recurring events have video
            const hasVideo = finalMediaUrl && isVideo(finalMediaUrl);
            
            if (hasVideo) {
              // Video recurring events need processing - save to pending
              await saveRecurringPendingEvents(recurringEvents);
              Alert.alert(
                '✅ Video Events Saved!',
                '📽️ Your video events are being processed and will go live when ready. You may close the app - we\'ll handle the rest!'
              );
            } else {
              // Image recurring events - save directly to live events
              await saveRecurringEventsToFirebase(recurringEvents);
              Alert.alert(
                '✅ Events Created!',
                '🎉 Your recurring events are now live and visible in the feed!'
              );
            }
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
          // ✅ FIXED: Check if event has video or just image/none
          const hasVideo = finalMediaUrl && isVideo(finalMediaUrl);
          
          if (hasVideo) {
            // Video events need processing - save to pending
            await savePendingEvent(baseEvent);
            Alert.alert(
              '✅ Video Event Saved!',
              '📽️ Your video is being processed and will go live when ready. You may close the app - we\'ll handle the rest!'
            );
          } else {
            // Image events or no media - save directly to live events
            await saveEventToFirebase(baseEvent);
            Alert.alert(
              '✅ Event Created!',
              '🎉 Your event is now live and visible in the feed!'
            );
          }
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
      Alert.alert('Error', getErrorMessage(error));
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
      image: event.image,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceCount: undefined,
      customDates: [],
    });
    setEditingEventId(event.id);
  };

  const deleteEvent = (eventId: string) => {
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

  const deletePendingEventAction = (eventId: string) => {
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

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['businessCode', 'isBusiness']);
      router.replace('/');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/');
    }
  };

  // Helper functions for simplified events list
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIndicator = (event: FirebaseEvent, isPending: boolean) => {
    if (isPending) {
      return '🟡'; // Yellow for processing/pending
    }
    
    // ✅ FIXED: All live events (in events collection) are ready
    return '🟢'; // Green for live/ready
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
        <LinearGradient 
          colors={['rgba(255, 255, 255, 0.96)', 'rgb(30, 120, 120)']} 
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </ImageBackground>
    );
  }

  // Combine all events and sort by date (newest first)
  const allEvents = [
    ...events.map(e => ({ ...e, isPending: false })),
    ...pendingEvents.map(e => ({ ...e, isPending: true }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <ImageBackground source={backgroundPattern} style={styles.background} resizeMode="repeat">
      <LinearGradient 
        colors={['rgba(255, 255, 255, 0.96)', 'rgb(30, 120, 120)']} 
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.container}>
        
        {/* Logo Button - Same as business dashboard */}
        <TouchableOpacity
          style={styles.logoButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Image source={heyByronBlackLogo} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>

        {/* Top Right Buttons */}
        <View style={styles.topRightButtons}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.businessButtonTopRight} 
            onPress={navigateToBusiness}
          >
            <Text style={styles.businessButtonText}>Business →</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.content} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              
              {/* YOUR EVENTS SECTION - NOW ON TOP */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Your Events</Text>
                  <View style={styles.eventCountBadge}>
                    <Text style={styles.eventCountText}>{allEvents.length}</Text>
                  </View>
                </View>

                <View style={styles.eventsListContainer}>
                  {allEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>📅</Text>
                      <Text style={styles.emptyStateText}>No events yet</Text>
                      <Text style={styles.emptyStateSubtext}>
                        Create your first event to start attracting customers!
                      </Text>
                    </View>
                  ) : (
                    <ScrollView 
                      style={styles.eventsList} 
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {allEvents.map((event) => (
                        <View key={`${event.id}-${event.isPending ? 'pending' : 'live'}`} style={styles.eventCard}>
                          <View style={styles.eventContent}>
                            <View style={styles.eventHeader}>
                              <View style={styles.eventTitleRow}>
                                <Text style={styles.statusIndicator}>
                                  {getStatusIndicator(event, event.isPending)}
                                </Text>
                                <Text style={styles.eventTitle} numberOfLines={2}>
                                  {event.title}
                                </Text>
                              </View>
                              <Text style={styles.eventDate}>
                                {formatDate(event.date)}
                              </Text>
                            </View>
                            
                            <View style={styles.eventActions}>
                              <TouchableOpacity
                                style={styles.editEventButton}
                                onPress={() => editEvent(event)}
                              >
                                <Text style={styles.editEventButtonText}>Edit</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity
                                style={styles.deleteEventButton}
                                onPress={() => event.isPending ? deletePendingEventAction(event.id) : deleteEvent(event.id)}
                              >
                                <Text style={styles.deleteEventButtonText}>×</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>

              {/* Event Form - SIMPLIFIED WITHOUT HEADER */}
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#1a1a1a',
    marginTop: 16,
    fontSize: 16,
  },
  logoButton: {
    position: 'absolute',
    left: 6,
    top: Platform.OS === 'ios' ? 25 : 5,
    padding: 8,
    zIndex: 10,
  },
  logoImage: {
    width: 150,
    height: 50,
  },
  topRightButtons: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'ios' ? 42 : 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 59, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  businessButtonTopRight: {
    padding: 8,
  },
  businessButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 90 : 70,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // Events list styles
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  eventCountBadge: {
    backgroundColor: '#4a9b8e',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  eventCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  eventsListContainer: {
    maxHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  eventsList: {
    maxHeight: 350,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    marginBottom: 12,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  statusIndicator: {
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    lineHeight: 22,
  },
  eventDate: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editEventButton: {
    backgroundColor: 'rgba(74, 155, 142, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 142, 0.3)',
  },
  editEventButtonText: {
    color: '#4a9b8e',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteEventButton: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  deleteEventButtonText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '600',
  },
});