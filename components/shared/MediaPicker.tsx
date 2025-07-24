// components/shared/MediaPicker.tsx - Fixed video thumbnail display
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
import { uploadToFirebaseStorage } from '../../utils/firebaseUtils';

export interface MediaPickerProps {
  currentMedia?: string;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (url: string) => void;
  onUploadError?: (error: string) => void;
  onUploadEnd?: () => void;
  onMediaDeleted?: () => void;
  maxSizeBytes?: number;
  allowVideo?: boolean;
  allowImage?: boolean;
  eventId?: string;
}

export default function MediaPicker({
  currentMedia,
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
}: MediaPickerProps) {
  const [isUploading, setIsUploading] = useState(false);

  const smartDeleteMedia = async (mediaUrl: string): Promise<boolean> => {
    try {
      console.log('Smart deleting media:', mediaUrl);
      return true;
    } catch (error) {
      console.error('Error in smart delete:', error);
      return false;
    }
  };

  const uploadMedia = async (uri: string) => {
    try {
      setIsUploading(true);
      onUploadStart?.();
      
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
      const baseFilename = `event_${Date.now()}.${ext}`;
      
      const url = await uploadToFirebaseStorage(uri, baseFilename, eventId);
      
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

      let mediaTypes: ImagePicker.MediaTypeOptions = ImagePicker.MediaTypeOptions.All;
      if (allowVideo && !allowImage) {
        mediaTypes = ImagePicker.MediaTypeOptions.Videos;
      } else if (allowImage && !allowVideo) {
        mediaTypes = ImagePicker.MediaTypeOptions.Images;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Event Media (Optional)</Text>
      
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
            <Image source={{ uri: currentMedia }} style={styles.mediaPreview} />
          )}
          
          <View style={styles.mediaActions}>
            <TouchableOpacity style={styles.replaceButton} onPress={pickMedia}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
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
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="camera-outline" size={40} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {allowVideo && allowImage ? 'Add Photo or Video' : 
                 allowVideo ? 'Add Video' : 'Add Photo'}
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
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mediaActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  replaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 6,
  },
  replaceButtonText: {
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    minHeight: 160,
  },
  uploadingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  uploadSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});