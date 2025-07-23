// components/events/EventsList.tsx
// Events list component extracted from dashboard.tsx

import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { isImage, isVideo } from '../../constants/fileConfig';
import { FirebaseEvent } from '../../utils/firebaseUtils';

export interface EventsListProps {
  events: FirebaseEvent[];
  pendingEvents: FirebaseEvent[];
  onEdit: (event: FirebaseEvent) => void;
  onDelete: (eventId: string) => void;
  onDeletePending: (eventId: string) => void;
}

// Video Preview Component (shows first frame as thumbnail)
function VideoPreview({ uri }: { uri: string }) {
  return (
    <Video 
      style={styles.eventImg}
      source={{ uri }}
      shouldPlay={false}
      useNativeControls={false}
      resizeMode={ResizeMode.COVER}
      isLooping={false}
    />
  );
}

export default function EventsList({
  events,
  pendingEvents,
  onEdit,
  onDelete,
  onDeletePending,
}: EventsListProps) {

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

  const totalEvents = events.length + pendingEvents.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Your Events</Text>
        <View style={styles.eventCountBadge}>
          <Text style={styles.eventCountText}>{totalEvents}</Text>
        </View>
      </View>

      <View style={styles.eventsListContainer}>
        {totalEvents === 0 ? (
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
          >
            {/* Live Events */}
            {events.length > 0 && (
              <>
                <Text style={styles.eventsListTitle}>
                  🟢 Live Events ({events.length})
                </Text>
                {events.map((event) => (
                  <View key={event.id} style={styles.eventCard}>
                    {/* Event Media */}
                    {event.image && (
                      <View style={styles.eventMediaContainer}>
                        {isImage(event.image) ? (
                          <Image 
                            source={{ uri: event.image }} 
                            style={styles.eventImg}
                            resizeMode="cover"
                          />
                        ) : isVideo(event.video || '') ? (
                          <VideoPreview uri={event.video || ''} />
                        ) : null}
                      </View>
                    )}
                    
                    {/* Event Content */}
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={styles.eventDate}>
                          {formatDate(event.date)}
                        </Text>
                      </View>
                      
                      {event.caption && (
                        <Text style={styles.eventCaption} numberOfLines={2}>
                          {event.caption}
                        </Text>
                      )}
                      
                      {event.tags && event.tags.length > 0 && (
                        <View style={styles.eventTags}>
                          {event.tags.slice(0, 3).map((tag, index) => (
                            <Text key={index} style={styles.eventTag}>
                              {tag}
                            </Text>
                          ))}
                          {event.tags.length > 3 && (
                            <Text style={styles.eventTag}>
                              +{event.tags.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                      
                      {/* Action Buttons */}
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.editEventButton}
                          onPress={() => onEdit(event)}
                        >
                          <Ionicons name="create-outline" size={18} color="#fff" />
                          <Text style={styles.editEventButtonText}>Edit</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.deleteEventButton}
                          onPress={() => onDelete(event.id)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#000" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Pending Events */}
            {pendingEvents.length > 0 && (
              <>
                <Text style={styles.eventsListTitle}>
                  🟡 Processing Events ({pendingEvents.length})
                </Text>
                <View style={styles.processingNotice}>
                  <Text style={styles.processingNoticeText}>
                    📽️ These events with videos are being compressed by our servers. 
                    They'll go live automatically when processing completes (usually 1-2 minutes).
                  </Text>
                </View>
                
                {pendingEvents.map((event) => (
                  <View key={event.id} style={[styles.eventCard, styles.pendingEventCard]}>
                    {/* Event Media */}
                    {event.image && (
                      <View style={styles.eventMediaContainer}>
                        {isImage(event.image) ? (
                          <Image 
                            source={{ uri: event.image }} 
                            style={styles.eventImg}
                            resizeMode="cover"
                          />
                        ) : isVideo(event.video || '') ? (
                          <VideoPreview uri={event.video || ''} />
                        ) : null}
                      </View>
                    )}
                    
                    {/* Event Content */}
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={styles.eventDate}>
                          {formatDate(event.date)}
                        </Text>
                      </View>
                      
                      <View style={styles.processingStatus}>
                        <Text style={styles.processingStatusText}>
                          🔄 Processing video...
                        </Text>
                      </View>
                      
                      {/* Action Buttons */}
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.deleteEventButton}
                          onPress={() => onDeletePending(event.id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#000" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  eventCountBadge: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  eventCountText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  eventsListContainer: {
    maxHeight: 600,
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  eventsList: {
    maxHeight: 550,
  },
  eventsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  processingNotice: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  processingNoticeText: {
    color: '#ffc107',
    fontSize: 13,
    lineHeight: 18,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pendingEventCard: {
    opacity: 0.8,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  eventMediaContainer: {
    width: '100%',
    height: 180,
  },
  eventImg: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  eventCaption: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  eventTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  eventTag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '500',
  },
  processingStatus: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  processingStatusText: {
    color: '#ffc107',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editEventButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteEventButton: {
    backgroundColor: '#fff',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 