// utils/errorHandling.tsx
// Error handling components and utilities

import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Enhanced error detection helper
export const isConnectionError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('fetch') ||
    errorCode.includes('network') ||
    errorCode.includes('unavailable') ||
    errorCode === 'auth/network-request-failed' ||
    error?.name === 'NetworkError'
  );
};

// Improved error message helper
export const getErrorMessage = (error: any, operation: string): string => {
  if (isConnectionError(error)) {
    return `Could not ${operation}. Please check your connection and try again.`;
  }
  
  // Generic fallback for other errors
  return `Failed to ${operation}. Please try again.`;
};

// Enhanced Firebase error handler
export const handleFirebaseError = (error: any): string => {
  console.error('Firebase Error:', error);
  
  // Network/connection errors
  if (isConnectionError(error) || error.code === 'unavailable') {
    return 'No internet connection. Please check your connection and try again.';
  }
  
  // Permission errors
  if (error.code === 'permission-denied') {
    return 'Access denied. You may not have permission to view this content.';
  }
  
  // Not found errors
  if (error.code === 'not-found') {
    return 'Content not found. It may have been deleted or moved.';
  }
  
  // Quota exceeded
  if (error.code === 'resource-exhausted') {
    return 'Service temporarily busy. Please try again in a few minutes.';
  }
  
  // Authentication errors
  if (error.code?.startsWith('auth/')) {
    return 'Authentication error. Please try signing in again.';
  }
  
  // Storage errors
  if (error.code?.startsWith('storage/')) {
    if (error.code === 'storage/object-not-found') {
      return 'File not found. It may have been deleted.';
    }
    if (error.code === 'storage/quota-exceeded') {
      return 'Storage limit reached. Please try again later.';
    }
    return 'File upload failed. Please try again.';
  }
  
  // Generic Firebase errors
  if (error.code) {
    return `Service temporarily unavailable. Please try again later. (${error.code})`;
  }
  
  // Network fetch errors
  if (error?.name === 'TypeError' && error.message?.includes('fetch')) {
    return 'Connection failed. Please check your internet and try again.';
  }
  
  // Generic fallback
  return 'Something went wrong. Please try again later.';
};

// ==========================================
// REACT COMPONENTS
// ==========================================

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({ 
  onRetry, 
  message = "No internet connection. Please check your connection and try again." 
}) => (
  <View style={styles.errorContainer}>
    <Ionicons name="wifi-outline" size={48} color="#FF6B6B" />
    <Text style={styles.errorTitle}>Connection Problem</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Ionicons name="refresh-outline" size={20} color="#000" style={{ marginRight: 8 }} />
      <Text style={styles.retryButtonText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

interface LoadingWithErrorProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
  loadingMessage?: string;
}

export const LoadingWithError: React.FC<LoadingWithErrorProps> = ({
  loading,
  error,
  onRetry,
  children,
  loadingMessage = "Loading..."
}) => {
  if (error) {
    return <NetworkError onRetry={onRetry} message={error} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="rgba(194, 164, 120, 1)" />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

interface VideoErrorFallbackProps {
  onRetry: () => void;
  imageUri?: string;
  title?: string;
}

export const VideoErrorFallback: React.FC<VideoErrorFallbackProps> = ({ 
  onRetry, 
  imageUri, 
  title = "Video Error" 
}) => (
  <View style={styles.videoErrorContainer}>
    <View style={styles.videoErrorOverlay}>
      <Ionicons name="play-circle-outline" size={48} color="#fff" />
      <Text style={styles.videoErrorTitle}>Video unavailable</Text>
      <Text style={styles.videoErrorMessage}>Tap to retry</Text>
    </View>
    <TouchableOpacity style={styles.videoRetryButton} onPress={onRetry}>
      <Ionicons name="refresh-outline" size={20} color="#fff" />
    </TouchableOpacity>
  </View>
);

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: 'rgba(194, 164, 120, 1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    fontWeight: '500',
  },
  videoErrorContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoErrorOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoErrorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  videoErrorMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  videoRetryButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
});