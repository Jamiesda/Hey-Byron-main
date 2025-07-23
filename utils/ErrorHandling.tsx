// utils/ErrorHandling.tsx - New file to create
// Error handling components for the app

import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { Component, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 1. NETWORK CONNECTIVITY HOOK
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, isLoading };
};

// 2. ERROR BOUNDARY COMPONENT
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={errorStyles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#FF6B6B" />
          <Text style={errorStyles.errorTitle}>Something went wrong</Text>
          <Text style={errorStyles.errorMessage}>
            The app encountered an unexpected error. Please restart the app.
          </Text>
          <TouchableOpacity
            style={errorStyles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// 3. NETWORK ERROR COMPONENT
interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({ 
  onRetry, 
  message = "No internet connection. Please check your connection and try again." 
}) => (
  <View style={errorStyles.errorContainer}>
    <Ionicons name="wifi-outline" size={48} color="#FF6B6B" />
    <Text style={errorStyles.errorTitle}>Connection Problem</Text>
    <Text style={errorStyles.errorMessage}>{message}</Text>
    <TouchableOpacity style={errorStyles.retryButton} onPress={onRetry}>
      <Ionicons name="refresh-outline" size={20} color="#000" style={{ marginRight: 8 }} />
      <Text style={errorStyles.retryButtonText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

// 4. LOADING WITH ERROR STATE COMPONENT
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
      <View style={errorStyles.loadingContainer}>
        <ActivityIndicator size="large" color="rgba(194, 164, 120, 1)" />
        <Text style={errorStyles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

// 5. VIDEO ERROR FALLBACK COMPONENT
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
  <View style={errorStyles.videoErrorContainer}>
    <View style={errorStyles.videoErrorOverlay}>
      <Ionicons name="play-circle-outline" size={48} color="#fff" />
      <Text style={errorStyles.videoErrorTitle}>Video unavailable</Text>
      <Text style={errorStyles.videoErrorMessage}>Tap to retry</Text>
    </View>
    <TouchableOpacity style={errorStyles.videoRetryButton} onPress={onRetry}>
      <Ionicons name="refresh-outline" size={20} color="#fff" />
    </TouchableOpacity>
  </View>
);

// 6. ENHANCED FIREBASE ERROR HANDLER
export const handleFirebaseError = (error: any): string => {
  console.error('Firebase Error:', error);
  
  // Network errors
  if (error.code === 'unavailable' || error.message?.includes('network')) {
    return 'No internet connection. Please check your connection and try again.';
  }
  
  // Permission errors
  if (error.code === 'permission-denied') {
    return 'Access denied. Please check your permissions.';
  }
  
  // Not found errors
  if (error.code === 'not-found') {
    return 'Requested data not found. It may have been deleted.';
  }
  
  // Generic Firebase errors
  if (error.code) {
    return `Service temporarily unavailable (${error.code}). Please try again later.`;
  }
  
  // Unknown errors
  return 'Something went wrong. Please try again later.';
};

// STYLES
const errorStyles = StyleSheet.create({
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