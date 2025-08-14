// components/business/BusinessForm.tsx
// FIXED VERSION - Single upload path, no duplication

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
  businessId: string;
  // REMOVED: onImageSelected and onImageDeleted - MediaPicker handles everything
}

export default function BusinessForm({
  businessData,
  onSave,
  loading,
  onDataChange,
  businessId,
}: BusinessFormProps) {

  const handleFieldChange = (field: keyof BusinessFormData) => (value: string) => {
    onDataChange({ [field]: value });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Business Information</Text>
      
      {/* Business Image Picker - SINGLE SOURCE OF TRUTH */}
      <MediaPicker
        uploadType="business"
        businessId={businessId}
        currentMedia={businessData.image}
        maxSizeBytes={MAX_IMAGE_SIZE}
        allowVideo={false}
        allowImage={true}
        onUploadComplete={(url) => {
          // ONLY update the form data - no duplicate upload
          onDataChange({ image: url });
        }}
        onMediaDeleted={() => {
          // ONLY clear the form data - MediaPicker handles Firebase deletion
          onDataChange({ image: undefined });
        }}
        onUploadError={(error) => {
          console.error('Business image upload error:', error);
          // Could add Alert here if you want user-facing error messages
        }}
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
          placeholder="e.g. restaurant, cafe, food"
          multiline
        />
      </View>

      <FormInput
        label="Website"
        value={businessData.website}
        onChangeText={handleFieldChange('website')}
        placeholder="https://yourwebsite.com"
        maxLength={200}
      />

      <FormInput
        label="Social Links"
        value={businessData.socialLinks}
        onChangeText={handleFieldChange('socialLinks')}
        placeholder="Instagram, Facebook URLs (comma separated)"
        multiline
        maxLength={500}
      />

      <LoadingButton
        title="Save Business"
        onPress={onSave}
        loading={loading}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minHeight: 50,
  },
  saveButton: {
    marginTop: 20,
  },
});