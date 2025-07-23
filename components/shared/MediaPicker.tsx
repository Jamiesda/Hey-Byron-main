// components/shared/MediaPicker.tsx
// Reusable media picker component with delete functionality

import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from 'react-native';
import { isImage, isVideo } from '../../constants/fileConfig';
import { db } from '../../firebaseConfig';
import { deleteFileFromFirebaseStorage, uploadToFirebaseStorage } from '../../utils/firebaseUtils';

export interface MediaPickerProps {
  onMediaSelected: (uri: string) => void;
  currentMedia?: string;
  type: 'image' | 'video' | 'both';
  maxSize: number;
  style?: ViewStyle;
  buttonText?: string;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (url: string) => void;
  onUploadError?: (error: string) => void;
  onMediaDeleted?: () => void; // NEW: Callback when media is deleted
  showDeleteButton?: boolean; // NEW: Option to show/hide delete button
}

export default function MediaPicker({
  onMediaSelected,
  currentMedia,
  type,
  maxSize,
  style,
  buttonText,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onMediaDeleted,
  showDeleteButton = true, // Default to true
}: MediaPickerProps) {

  // Helper function to get file size
  const getFileSize = async (uri: string): Promise<number> => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? info.size || 0 : 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  };

  // Helper function to format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  // Smart delete that checks if media is used by other events
  const smartDeleteMedia = async (mediaUrl: string): Promise<boolean> => {
    try {
      if (!mediaUrl || !mediaUrl.includes('firebasestorage.googleapis.com')) {
        return false;
      }

      // Check how many events are using this media file
      const eventsCollection = collection(db, 'events');
      const [imageQuery, videoQuery] = await Promise.all([
        getDocs(query(eventsCollection, where('image', '==', mediaUrl))),
        getDocs(query(eventsCollection, where('video', '==', mediaUrl)))
      ]);

      const totalUsage = imageQuery.docs.length + videoQuery.docs.length;
      
      if (totalUsage <= 1) {
        // Safe to delete - only used by current event
        await deleteFileFromFirebaseStorage(mediaUrl);
        return true;
      } else {
        // Still used by other events - don't delete
        console.log(`Media still used by ${totalUsage} events - keeping file`);
        return false;
      }
    } catch (error) {
      console.error('Error in smart media delete:', error);
      return false;
    }
  };

  // Get count of events using this media
  const getMediaUsageCount = async (mediaUrl: string): Promise<number> => {
    try {
      if (!mediaUrl || !mediaUrl.includes('firebasestorage.googleapis.com')) {
        return 0;
      }

      const eventsCollection = collection(db, 'events');
      const [imageQuery, videoQuery] = await Promise.all([
        getDocs(query(eventsCollection, where('image', '==', mediaUrl))),
        getDocs(query(eventsCollection, where('video', '==', mediaUrl)))
      ]);

      return imageQuery.docs.length + videoQuery.docs.length;
    } catch (error) {
      console.error('Error getting media usage count:', error);
      return 0;
    }
  };

  // Delete media with smart recurring event handling
  const deleteMedia = async () => {
    if (!currentMedia) return;

    try {
      // Check how many events use this media
      const usageCount = await getMediaUsageCount(currentMedia);
      
      let alertMessage = 'Are you sure you want to delete this media?';
      if (usageCount > 1) {
        alertMessage = `This media is used by ${usageCount} events. Deleting it will remove the media from all of them. Continue?`;
      }

      Alert.alert(
        'Delete Media',
        alertMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const wasDeleted = await smartDeleteMedia(currentMedia);
                onMediaDeleted?.(); // Always clear from current form
                
                if (wasDeleted) {
                  console.log('✅ Media deleted from Firebase Storage');
                } else {
                  console.log('ℹ️ Media kept in Firebase (used by other events)');
                }
              } catch (error) {
                console.error('Error deleting media:', error);
                onUploadError?.('Failed to delete media. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error checking media usage:', error);
      // Fallback to simple delete if usage check fails
      Alert.alert(
        'Delete Media',
        'Are you sure you want to delete this media?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await smartDeleteMedia(currentMedia);
                onMediaDeleted?.();
              } catch (deleteError) {
                console.error('Error deleting media:', deleteError);
                onUploadError?.('Failed to delete media. Please try again.');
              }
            }
          }
        ]
      );
    }
  };

  // Upload function - Enhanced to delete old media when replacing
  const uploadMedia = async (uri: string) => {
    try {
      onUploadStart?.();
      
      // Smart delete old media when replacing
      if (currentMedia && currentMedia.includes('firebasestorage.googleapis.com')) {
        try {
          console.log('🔄 Replacing media - checking if safe to delete old file...');
          const wasDeleted = await smartDeleteMedia(currentMedia);
          if (wasDeleted) {
            console.log('✅ Old media deleted from Firebase Storage');
          } else {
            console.log('ℹ️ Old media kept in Firebase (used by other events)');
          }
        } catch (deleteError) {
          console.warn('⚠️ Could not delete old media:', deleteError);
        }
      }
      
      const ext = uri.split('.').pop() || (isVideo(uri) ? 'mp4' : 'jpg');
      const filename = `event_${Date.now()}.${ext}`;
      
      // Upload using the 2-parameter function signature
      const url = await uploadToFirebaseStorage(uri, filename);
      
      // Simulate progress for UI feedback
      onUploadProgress?.(100);
      
      onUploadComplete?.(url);
      onMediaSelected(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError?.(errorMessage);
    }
  };

  // Main media picker function
  const pickMedia = async () => {
    try {
      // Clear any previous errors
      onUploadError?.('');
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photo library to select media.');
        return;
      }

      // Determine media types based on prop - FIXED: Use correct API
      let mediaTypes;
      if (type === 'image') {
        mediaTypes = ImagePicker.MediaTypeOptions.Images;
      } else if (type === 'video') {
        mediaTypes = ImagePicker.MediaTypeOptions.Videos;
      } else {
        mediaTypes = ImagePicker.MediaTypeOptions.All;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.6,
        mediaTypes,
        allowsEditing: false,
        videoMaxDuration: 30,
      });
      
      if (!result.canceled && result.assets.length) {
        const asset = result.assets[0];
        
        // Check file size
        const fileSize = await getFileSize(asset.uri);
        if (fileSize > maxSize) {
          const isVideoAsset = asset.type === 'video' || isVideo(asset.uri);
          const mediaType = isVideoAsset ? 'video' : 'image';
          
          Alert.alert(
            `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Too Large`,
            `Your ${mediaType} is ${formatFileSize(fileSize)} but our limit is ${formatFileSize(maxSize)}.${
              isVideoAsset ? '\n\n📱 Tips to reduce size:\n• Record shorter videos (5-15 seconds)\n• Use your phone\'s built-in video editor\n• Record in standard quality (not 4K)' : ''
            }`,
            [
              { text: 'Try Again', onPress: () => pickMedia() },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          return;
        }
        
        // Upload the media (this will also delete old media if replacing)
        await uploadMedia(asset.uri);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select media';
      onUploadError?.(errorMessage);
    }
  };

  // Determine button text
  const getButtonText = () => {
    if (buttonText) return buttonText;
    
    if (currentMedia) {
      if (isVideo(currentMedia)) return 'Change Video';
      if (isImage(currentMedia)) return 'Change Photo';
      return 'Change Media';
    }
    
    switch (type) {
      case 'image': return 'Select Photo';
      case 'video': return 'Select Video';
      default: return 'Select Photo/Video';
    }
  };

  return (
    <View style={styles.container}>
      {/* Media Preview with Delete Button */}
      {currentMedia && (
        <View style={styles.mediaPreview}>
          <View style={styles.imageContainer}>
            {isImage(currentMedia) ? (
              <Image source={{ uri: currentMedia }} style={styles.previewImage} />
            ) : isVideo(currentMedia) ? (
              <View style={styles.videoPreview}>
                <Image source={{ uri: currentMedia }} style={styles.previewImage} />
                <View style={styles.videoOverlay}>
                  <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
                </View>
              </View>
            ) : null}
            
            {/* Delete Button - NEW */}
            {showDeleteButton && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={deleteMedia}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color="#ff4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {/* Picker Button */}
      <TouchableOpacity 
        style={[styles.pickerButton, style]} 
        onPress={pickMedia}
      >
        <Text style={styles.pickerButtonText}>{getButtonText()}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mediaPreview: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  videoPreview: {
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    zIndex: 10,
  },
  pickerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});