// components/shared/LoadingButton.tsx
// Reusable loading button component extracted from dashboard.tsx

import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';

export interface LoadingButtonProps {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
  title: string;
  loadingTitle?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loadingColor?: string;
}

export default function LoadingButton({
  onPress,
  loading,
  disabled = false,
  title,
  loadingTitle = 'Loading...',
  style,
  textStyle,
  loadingColor = '#000',
}: LoadingButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <TouchableOpacity 
      style={[
        styles.primaryButton, 
        isDisabled && styles.primaryButtonDisabled,
        style
      ]} 
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <View style={styles.loadingButtonContainer}>
          <ActivityIndicator size="small" color={loadingColor} />
          <Text style={[styles.primaryButtonText, textStyle]}>{loadingTitle}</Text>
        </View>
      ) : (
        <Text style={[styles.primaryButtonText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
}); 