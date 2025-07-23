// components/business/BusinessForm.tsx
// Business form component with delete functionality

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MAX_IMAGE_SIZE } from '../../constants/fileConfig';
import { FormInput, LoadingButton, MediaPicker } from '../shared';

export interface BusinessFormData {
  name: string;
  address: string;
  description: string;
  tags: string;
  website: string;
  socialLinks: string;
  image?: string;
}

export interface BusinessFormProps {
  businessData: BusinessFormData;
  onSave: () => void;
  loading: boolean;
  onDataChange: (data: Partial<BusinessFormData>) => void;
  onImageSelected: (uri: string) => void;
  onImageDeleted?: () => void; // NEW: Callback when image is deleted
}

export default function BusinessForm({
  businessData,
  onSave,
  loading,
  onDataChange,
  onImageSelected,
  onImageDeleted,
}: BusinessFormProps) {

  const handleFieldChange = (field: keyof BusinessFormData) => (value: string) => {
    onDataChange({ [field]: value });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Business Information</Text>
      
      
      {/* Business Image Picker with Delete */}
      <MediaPicker
        onMediaSelected={onImageSelected}
        currentMedia={businessData.image}
        type="image"
        maxSize={MAX_IMAGE_SIZE}
        buttonText={businessData.image ? 'Change Business Image' : 'Add Business Image'}
        onMediaDeleted={() => {
          // Clear the image from business data when deleted
          onDataChange({ image: undefined });
          onImageDeleted?.();
        }}
        showDeleteButton={true}
      />

      {/* Business Form Fields */}
      <FormInput
        label="Business Name"
        value={businessData.name}
        onChangeText={handleFieldChange('name')}
        placeholder="Enter your business name"
        maxLength={50}
        required
      />

      <FormInput
        label="Address"
        value={businessData.address}
        onChangeText={handleFieldChange('address')}
        placeholder="Enter your business address"
        maxLength={200}
        required
      />

      <FormInput
        label="Description"
        value={businessData.description}
        onChangeText={handleFieldChange('description')}
        placeholder="Describe your business"
        multiline
        numberOfLines={4}
        maxLength={2500}
        required
      />

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Tags *</Text>
        <TextInput
          style={styles.input}
          value={businessData.tags}
          onChangeText={handleFieldChange('tags')}
          placeholder="e.g. restaurant, cafe, italian"
          placeholderTextColor="rgba(255,255,255,0.5)"
          maxLength={100}
        />
        <Text style={styles.helperText}>
          Separate tags with commas (e.g. restaurant, cafe, italian)
        </Text>
      </View>

      <FormInput
        label="Website"
        value={businessData.website}
        onChangeText={handleFieldChange('website')}
        placeholder="https://yourwebsite.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={200}
      />

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Social Links</Text>
        <TextInput
          style={styles.input}
          value={businessData.socialLinks}
          onChangeText={handleFieldChange('socialLinks')}
          placeholder="https://instagram.com/yourbusiness, https://facebook.com/yourbusiness"
          placeholderTextColor="rgba(255,255,255,0.5)"
          maxLength={300}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>
          Separate multiple links with commas
        </Text>
      </View>

      <LoadingButton
        onPress={onSave}
        loading={loading}
        title="Save Business Information"
        loadingTitle="Saving..."
      />
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  cloudIndicator: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
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
  helperText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },
});