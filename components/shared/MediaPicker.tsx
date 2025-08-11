// components/shared/MediaPicker.tsx - Simplified with light background styling
// Uses same compression rules for both (quality: 0.8, no forced cropping)
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { isVideo } from '../../constants/fileConfig';
import {
  deleteBusinessImageFromFirebase,
  deleteFileFromFirebaseStorage,
  uploadBusinessImageToFirebase,
  uploadToFirebaseStorage
} from '../../utils/firebaseUtils';

export interface MediaPickerProps {
  // Core props
  currentMedia?: string;
  uploadType?: 'event' | 'business';
  businessId?: string;
  
  // Callback props
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (url: string) => void;
  onUploadError?: (error: string) => void;
  onUploadEnd?: () => void;
  onMediaDeleted?: () => void;
  
  // Configuration props
  maxSizeBytes?: number;
  allowVideo?: boolean;
  allowImage?: boolean;
  eventId?: string;
  
  // Display props
  label?: string;
}

export default function MediaPicker({
  currentMedia,
  uploadType = 'event',
  businessId,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onUploadEnd,
  onMediaDeleted,
  maxSizeBytes = 300 * 1024 * 1024,
  allowVideo = true,
  allowImage = true,
  eventId,
  label,
}: MediaPickerProps) {
  const [isUploading, setIsUploading] = useState(false);

  // Smart delete media based on upload type
  const smartDeleteMedia = async (mediaUrl: string): Promise<boolean> => {
    try {
      console.log('Smart deleting media:', mediaUrl, 'Type:', uploadType);
      
      if (uploadType === 'business') {
        await deleteBusinessImageFromFirebase(mediaUrl);
      } else {
        await deleteFileFromFirebaseStorage(mediaUrl);
      }
      
      return true;
    } catch (error) {
      console.error('Error in smart delete:', error);
      return false;
    }
  };

  // Upload media based on type
  const uploadMedia = async (uri: string) => {
    try {
      setIsUploading(true);
      onUploadStart?.();
      
      // Delete old media if replacing
      if (currentMedia && currentMedia.includes('firebasestorage.googleapis.com')) {
        try {
          console.log('🔄 Replacing media - deleting old file...');
          const wasDeleted = await smartDeleteMedia(currentMedia);
          if (wasDeleted) {
            console.log('✅ Old media deleted from Firebase Storage');
          } else {
            console.log('⚠️ Could not delete old media');
          }
        } catch (deleteError) {
          console.warn('⚠️ Could not delete old media:', deleteError);
        }
      }
      
      let url: string;
      
      if (uploadType === 'business') {
        // Business upload - images only
        if (!businessId) {
          throw new Error('Business ID is required for business uploads');
        }
        url = await uploadBusinessImageToFirebase(uri, businessId);
      } else {
        // Event upload - images and videos
        const ext = uri.split('.').pop() || (isVideo(uri) ? 'mp4' : 'jpg');
        const baseFilename = `event_${Date.now()}.${ext}`;
        url = await uploadToFirebaseStorage(uri, baseFilename, eventId);
      }
      
      onUploadProgress?.(100);
      onUploadComplete?.(url);
      console.log('✅ Media upload completed successfully');
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      onUploadError?.(error.message);
    } finally {
      setIsUploading(false);
      onUploadEnd?.();
    }
  };

  const handleDeleteMedia = async () => {
    if (!currentMedia) return;

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
              console.log('✅ Media deleted successfully');
            } catch (error) {
              console.error('Error deleting media:', error);
              onUploadError?.('Failed to delete media. Please try again.');
            }
          }
        }
      ]
    );
  };

  const pickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      // Determine media types based on upload type and props
      let mediaTypes: ImagePicker.MediaTypeOptions = ImagePicker.MediaTypeOptions.All;
      
      if (uploadType === 'business') {
        // Business uploads: images only
        mediaTypes = ImagePicker.MediaTypeOptions.Images;
      } else {
        // Event uploads: respect allowVideo and allowImage props
        if (allowVideo && !allowImage) {
          mediaTypes = ImagePicker.MediaTypeOptions.Videos;
        } else if (allowImage && !allowVideo) {
          mediaTypes = ImagePicker.MediaTypeOptions.Images;
        }
      }

      // Use same compression rules for both events and businesses
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: false,  // Don't force cropping - preserve original aspect ratio
        quality: 0.8,          // Same compression quality for both
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        if (asset.fileSize && asset.fileSize > maxSizeBytes) {
          const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
          Alert.alert(
            'File Too Large', 
            `Please select a file smaller than ${maxSizeMB}MB`
          );
          return;
        }

        await uploadMedia(asset.uri);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      onUploadError?.('Failed to select media. Please try again.');
    }
  };

  // Dynamic label based on upload type
  const getLabel = () => {
    if (label) return label;
    
    if (uploadType === 'business') {
      return 'Business Image (Optional)';
    }
    
    return 'Event Media (Optional)';
  };

  // Dynamic button text based on upload type
  const getButtonText = () => {
    if (uploadType === 'business') {
      return currentMedia ? 'Change Business Image' : 'Add Business Image';
    }
    
    if (allowVideo && allowImage) {
      return currentMedia ? 'Change Photo or Video' : 'Add Photo or Video';
    } else if (allowVideo) {
      return currentMedia ? 'Change Video' : 'Add Video';
    } else {
      return currentMedia ? 'Change Photo' : 'Add Photo';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{getLabel()}</Text>
      
      {currentMedia ? (
        <View style={styles.mediaContainer}>
          {isVideo(currentMedia) ? (
            <Video 
              style={styles.mediaPreview}
              source={{ uri: currentMedia }}
              shouldPlay={false}
              useNativeControls={false}
              resizeMode={ResizeMode.COVER}
              isLooping={false}
            />
          ) : (
            <Image 
              source={{ uri: currentMedia }} 
              style={styles.mediaPreview}
              resizeMode="cover"
            />
          )}
          
          <View style={styles.mediaActions}>
            <TouchableOpacity style={styles.replaceButton} onPress={pickMedia}>
              <Ionicons name="camera-outline" size={16} color="#000" />
              <Text style={styles.replaceButtonText}>Replace</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteMedia}>
              <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadButton} onPress={pickMedia} disabled={isUploading}>
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="camera-outline" size={40} color="#000" />
              <Text style={styles.uploadButtonText}>
                {getButtonText()}
              </Text>
              <Text style={styles.uploadSubtext}>
                Tap to select from gallery
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  mediaActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  replaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    gap: 6,
  },
  replaceButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  uploadButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    borderStyle: 'dashed',
    minHeight: 160,
  },
  uploadingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  uploadSubtext: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});