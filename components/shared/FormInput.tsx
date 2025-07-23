// components/shared/FormInput.tsx
// Standardized input component extracted from dashboard.tsx

import React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TextStyle,
    View,
    ViewStyle
} from 'react-native';

export interface FormInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  showCharacterCount?: boolean;
  errorMessage?: string;
}

export default function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline = false,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  showCharacterCount = true,
  errorMessage,
  ...textInputProps
}: FormInputProps) {
  
  const displayLabel = required ? `${label} *` : label;
  
  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {/* Label */}
      <Text style={[styles.inputLabel, labelStyle]}>
        {displayLabel}
      </Text>
      
      {/* Text Input */}
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          errorMessage && styles.inputError,
          inputStyle
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.5)"
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...textInputProps}
      />
      
      {/* Character Count and Error Message Row */}
      <View style={styles.bottomRow}>
        {/* Character Count */}
        {showCharacterCount && maxLength && (
          <Text style={[
            styles.characterCount,
            value.length > maxLength * 0.9 && styles.characterCountWarning,
            value.length >= maxLength && styles.characterCountError
          ]}>
            {value.length}/{maxLength} characters
          </Text>
        )}
        
        {/* Error Message */}
        {errorMessage && (
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 56,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 16,
  },
  inputError: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 20,
  },
  characterCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  characterCountWarning: {
    color: '#ffa726',
  },
  characterCountError: {
    color: '#ff6b6b',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
}); 