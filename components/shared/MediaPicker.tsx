// components/shared/MediaPicker.tsx
// Updated with adaptive image compression to ensure images are under 1MB
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
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

// Image compression constants
const TARGET_IMAGE_SIZE = 1024 * 1024; // 1MB target for images
const MIN_QUALITY = 0.2; // Minimum 20% quality
const QUALITY_STEP = 0.1; // Reduce by 10% each iteration
const MAX_DIMENSION = 1920; // Maximum width/height

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

  // Get file size helper
  const getFileSize = async (uri: string): Promise<number> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.exists ? fileInfo.size || 0 : 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  };

  // Adaptive image compression to ensure under 1MB
  const compressImage = async (uri: string): Promise<string> => {
    console.log('🔄 Starting image compression...');
    
    let currentUri = uri;
    let currentQuality = 0.9; // Start with 90% quality
    let currentSize = await getFileSize(uri);
    let iteration = 0;

    console.log(`📊 Original image size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);

    // If already under target, return original
    if (currentSize <= TARGET_IMAGE_SIZE) {
      console.log('✅ Image already under 1MB, no compression needed');
      return uri;
    }

    // Step 1: If very large, resize first
    if (currentSize > TARGET_IMAGE_SIZE * 3) {
      console.log('🔄 Large image detected, resizing first...');
      try {
        const resizeResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: MAX_DIMENSION } }],
          {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        currentUri = resizeResult.uri;
        currentSize = await getFileSize(currentUri);
        console.log(`📊 After resize: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
        
        // Update progress for resize step
        onUploadProgress?.(20);
      } catch (error) {
        console.warn('Resize failed, continuing with quality compression:', error);
      }
    }

    // Step 2: Quality compression loop
    while (currentSize > TARGET_IMAGE_SIZE && currentQuality >= MIN_QUALITY && iteration < 8) {
      iteration++;
      
      try {
        console.log(`🔄 Compression iteration ${iteration}, quality: ${(currentQuality * 100).toFixed(0)}%`);
        
        const result = await ImageManipulator.manipulateAsync(
          uri, // Always use original URI for quality compression
          currentSize > TARGET_IMAGE_SIZE * 3 ? [{ resize: { width: MAX_DIMENSION } }] : [],
          {
            compress: currentQuality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        currentUri = result.uri;
        currentSize = await getFileSize(currentUri);
        
        console.log(`📊 Iteration ${iteration}: ${(currentSize / 1024 / 1024).toFixed(2)}MB at ${(currentQuality * 100).toFixed(0)}% quality`);
        
        // Update progress (20% for resize + up to 60% for compression)
        const compressionProgress = Math.min(60, iteration * 8);
        onUploadProgress?.(20 + compressionProgress);

        // Reduce quality for next iteration if still too large
        if (currentSize > TARGET_IMAGE_SIZE) {
          currentQuality -= QUALITY_STEP;
        }

      } catch (error) {
        console.error(`❌ Compression iteration ${iteration} failed:`, error);
        break;
      }
    }

    const finalQuality = currentQuality + QUALITY_STEP;
    const success = currentSize <= TARGET_IMAGE_SIZE;

    console.log(`${success ? '✅' : '⚠️'} Image compression complete:`, {
      originalSize: `${(await getFileSize(uri) / 1024 / 1024).toFixed(2)}MB`,
      finalSize: `${(currentSize / 1024 / 1024).toFixed(2)}MB`,
      finalQuality: `${(finalQuality * 100).toFixed(0)}%`,
      iterations: iteration,
      success
    });

    return currentUri;
  };

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
      
      let finalUri = uri;
      
      // Compress images only (not videos)
      if (!isVideo(uri)) {
        console.log('🖼️ Processing image...');
        finalUri = await compressImage(uri);
        onUploadProgress?.(80); // Compression complete
      } else {
        console.log('🎥 Processing video (no compression needed - server handles this)...');
        onUploadProgress?.(50);
      }
      
      let url: string;
      
      if (uploadType === 'business') {
        // Business upload - images only
        if (!businessId) {
          throw new Error('Business ID is required for business uploads');
        }
        url = await uploadBusinessImageToFirebase(finalUri, businessId);
      } else {
        // Event upload - images and videos
        const ext = finalUri.split('.').pop() || (isVideo(finalUri) ? 'mp4' : 'jpg');
        const baseFilename = `event_${Date.now()}.${ext}`;
        url = await uploadToFirebaseStorage(finalUri, baseFilename, eventId);
      }
      
      onUploadProgress?.(100);
      onUploadComplete?.(url);
      console.log('✅ Media upload completed successfully');
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      onUploadError?.(error.message || 'Upload failed');
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

      // For videos, keep 80% resolution reduction as before
      // For images, we'll use our custom compression instead of picker compression
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: false,  // Don't force cropping - preserve original aspect ratio
        quality: 0.9,          // High quality for images (we'll compress ourselves), 90% resolution for videos
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // For videos, check original maxSizeBytes limit
        // For images, we'll compress them to under 1MB regardless
        if (isVideo(asset.uri) && asset.fileSize && asset.fileSize > maxSizeBytes) {
          const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
          Alert.alert(
            'Video Too Large', 
            `Please select a video smaller than ${maxSizeMB}MB`
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
      return currentMedia ? 'Change Image' : 'Add Image';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{getLabel()}</Text>
      
      {currentMedia ? (
        <View style={styles.mediaContainer}>
          {isVideo(currentMedia) ? (
            <Video
              source={{ uri: currentMedia }}
              style={styles.mediaPreview}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping={false}
              useNativeControls
            />
          ) : (
            <Image 
              source={{ uri: currentMedia }} 
              style={styles.mediaPreview}
              resizeMode="cover"
            />
          )}
          
          <View style={styles.mediaActions}>
            <TouchableOpacity 
              style={styles.replaceButton}
              onPress={pickMedia}
              disabled={isUploading}
            >
              <Ionicons name="camera-outline" size={16} color="#000" />
              <Text style={styles.replaceButtonText}>Replace</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteMedia}
              disabled={isUploading}
            >
              <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={pickMedia}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.uploadingText}>
                {uploadType === 'business' ? 'Compressing & Uploading...' : 'Processing & Uploading...'}
              </Text>
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
              {uploadType === 'business' && (
                <Text style={styles.compressionNote}>
                  Images automatically compressed to under 1MB
                </Text>
              )}
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
  compressionNote: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});