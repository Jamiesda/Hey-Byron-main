// components/events/EventForm.tsx - Video tips section completely removed (Fixed syntax)
// @ts-nocheck

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { MAX_VIDEO_SIZE } from '../../constants/fileConfig';
import { INTERNAL_OPTIONS } from '../../constants/interestOptions';
import { LoadingButton, MediaPicker } from '../shared';

export interface EventFormData {
  title: string;
  caption: string;
  link: string;
  interests: string[];
  date: Date;
  image?: string;
  isRecurring: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'custom';
  recurrenceCount?: number;
  customDates?: Date[];
}

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  isComplete: boolean;
}

export interface EventFormProps {
  eventData: EventFormData;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  uploadState: UploadState;
  onUploadStateChange: (state: Partial<UploadState>) => void;
  onDataChange: (data: Partial<EventFormData>) => void;
  onMediaSelected: () => void;
  editingMode?: boolean;
}

export default function EventForm({
  eventData,
  onSave,
  onCancel,
  loading,
  uploadState,
  onUploadStateChange,
  onDataChange,
  onMediaSelected,
  editingMode = false,
}: EventFormProps) {
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(eventData.date);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [tempCustomDate, setTempCustomDate] = useState(new Date());

  const handleFieldChange = (field: keyof EventFormData) => (value: any) => {
    onDataChange({ [field]: value });
  };

  const handleInterestToggle = (option: string) => {
    const updatedInterests = eventData.interests.includes(option)
      ? eventData.interests.filter(i => i !== option)
      : [...eventData.interests, option];
    onDataChange({ interests: updatedInterests });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleCustomDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setTempCustomDate(selectedDate);
    }
  };

  const saveDate = () => {
    onDataChange({ date: tempDate });
    setShowDateModal(false);
  };

  const saveCustomDate = () => {
    const currentDates = eventData.customDates || [];
    if (currentDates.length < 10) {
      onDataChange({
        customDates: [...currentDates, tempCustomDate].sort((a, b) => a.getTime() - b.getTime())
      });
    }
    setShowCustomDateModal(false);
  };

  const hasMandatoryFields = eventData.title.trim() && 
                            eventData.link.trim() && 
                            eventData.interests.length > 0 &&
                            (!eventData.isRecurring || 
                             (eventData.recurrenceType === 'custom' && (eventData.customDates?.length || 0) > 0) ||
                             (eventData.recurrenceType !== 'custom' && (eventData.recurrenceCount || 0) > 0));

  const isDisabled = loading || 
                     uploadState.isUploading || 
                     !!uploadState.error ||
                     !hasMandatoryFields;

  return (
    <View style={styles.eventFormCard}>
      <Text style={styles.eventFormTitle}>
        {editingMode ? 'Edit Event' : 'Create New Event'}
      </Text>

      <MediaPicker
        onMediaSelected={(url) => {
          onDataChange({ image: url });
        }}
        currentMedia={eventData.image}
        type="both"
        maxSize={MAX_VIDEO_SIZE}
        buttonText={eventData.image ? 'Change Event Media' : 'Add Event Media'}
        onUploadStart={() => {
          onUploadStateChange({ 
            isUploading: true, 
            progress: 0, 
            error: null, 
            isComplete: false 
          });
        }}
        onUploadProgress={(progress) => {
          onUploadStateChange({ progress });
        }}
        onUploadComplete={(url) => {
          onUploadStateChange({ 
            isUploading: false, 
            isComplete: true, 
            progress: 100 
          });
          onDataChange({ image: url });
        }}
        onUploadError={(error) => {
          onUploadStateChange({ 
            isUploading: false, 
            error, 
            isComplete: false 
          });
        }}
        onMediaDeleted={() => {
          onDataChange({ image: undefined });
          onUploadStateChange({
            isComplete: true,
            error: null
          });
        }}
        showDeleteButton={true}
      />

      {uploadState.isUploading && (
        <View style={styles.uploadProgress}>
          <Text style={styles.uploadProgressTitle}>
            📤 Uploading media... {uploadState.progress}% complete
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${uploadState.progress}%` }
              ]} 
            />
          </View>
          <Text style={styles.uploadProgressSubtext}>
            Continue filling out event details below
          </Text>
        </View>
      )}

      {uploadState.error && (
        <View style={styles.uploadError}>
          <Text style={styles.uploadErrorTitle}>⚠️ Upload Error</Text>
          <Text style={styles.uploadErrorText}>{uploadState.error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              onDataChange({ image: undefined });
            }}
          >
            <Text style={styles.retryButtonText}>Try Different File</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Event Title *</Text>
        <TextInput
          style={styles.input}
          value={eventData.title}
          onChangeText={handleFieldChange('title')}
          placeholder="What's happening?"
          placeholderTextColor="rgba(0,0,0,0.5)"
          maxLength={100}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Event Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={eventData.caption}
          onChangeText={handleFieldChange('caption')}
          placeholder="Tell people about your event"
          placeholderTextColor="rgba(0,0,0,0.5)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={300}
        />
        <Text style={styles.characterCount}>
          {eventData.caption.length}/300 characters
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Event Link *</Text>
        <TextInput
          style={styles.input}
          value={eventData.link}
          onChangeText={handleFieldChange('link')}
          placeholder="tickets.com"
          placeholderTextColor="rgba(0,0,0,0.5)"
          maxLength={200}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Event Categories *</Text>
        <View style={styles.interestsGrid}>
          {INTERNAL_OPTIONS.map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.interestChip,
                eventData.interests.includes(option) && styles.interestChipSelected
              ]}
              onPress={() => handleInterestToggle(option)}
            >
              <Text
                style={[
                  styles.interestChipText,
                  eventData.interests.includes(option) && styles.interestChipTextSelected
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Date & Time *</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            setTempDate(eventData.date);
            setShowDateModal(true);
          }}
        >
          <Text style={styles.datePickerText}>
            {formatDate(eventData.date)}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.toggleContainer}>
          <Text style={styles.inputLabel}>Repeat Event</Text>
          <Switch
            value={eventData.isRecurring}
            onValueChange={(value) => {
              onDataChange({ 
                isRecurring: value,
                ...(value ? {} : { recurrenceType: undefined, recurrenceCount: undefined, customDates: [] })
              });
            }}
            trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(79, 195, 247, 0.7)' }}
            thumbColor={eventData.isRecurring ? '#4fc3f7' : '#fff'}
          />
        </View>
      </View>

      {eventData.isRecurring && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Repeat Type *</Text>
          <View style={styles.recurrenceOptions}>
            {['daily', 'weekly', 'custom'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.recurrenceOption,
                  eventData.recurrenceType === type && styles.recurrenceOptionSelected
                ]}
                onPress={() => onDataChange({ 
                  recurrenceType: type as any,
                  ...(type === 'custom' ? { recurrenceCount: undefined } : { customDates: [] })
                })}
              >
                <Text
                  style={[
                    styles.recurrenceOptionText,
                    eventData.recurrenceType === type && styles.recurrenceOptionTextSelected
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {eventData.isRecurring && eventData.recurrenceType && eventData.recurrenceType !== 'custom' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Number of {eventData.recurrenceType} events *
          </Text>
          <TextInput
            style={styles.input}
            value={eventData.recurrenceCount?.toString() || ''}
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              const max = eventData.recurrenceType === 'daily' ? 30 : 10;
              onDataChange({ recurrenceCount: Math.min(Math.max(num, 1), max) });
            }}
            placeholder={eventData.recurrenceType === 'daily' ? "1-30" : "1-10"}
            placeholderTextColor="rgba(0,0,0,0.5)"
            keyboardType="numeric"
            maxLength={2}
          />
        </View>
      )}

      {eventData.isRecurring && eventData.recurrenceType === 'custom' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Custom Dates (Max: 10) *</Text>
          <View style={styles.customDatesContainer}>
            {(eventData.customDates || []).map((date, index) => (
              <View key={index} style={styles.customDateItem}>
                <Text style={styles.customDateText}>
                  {formatDate(date)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newDates = (eventData.customDates || []).filter((_, i) => i !== index);
                    onDataChange({ customDates: newDates });
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {(!eventData.customDates || eventData.customDates.length < 10) && (
            <TouchableOpacity
              style={styles.addDateButton}
              onPress={() => {
                setTempCustomDate(new Date());
                setShowCustomDateModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#4a9b8e" />
              <Text style={styles.addDateButtonText}>
                Add Date ({(eventData.customDates || []).length}/10)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <LoadingButton
        onPress={onSave}
        loading={loading || uploadState.isUploading}
        disabled={isDisabled}
        title={editingMode ? 'Update Event' : 'Save Event'}
        loadingTitle={
          loading ? 'Saving...' : 
          uploadState.isUploading ? `Uploading... ${uploadState.progress}%` : 
          'Saving...'
        }
      />

      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date & Time</Text>
            
            <DateTimePicker
              value={tempDate}
              mode="datetime"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
              textColor="#fff"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowDateModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={saveDate}
              >
                <Text style={styles.modalButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Date</Text>
            
            <DateTimePicker
              value={tempCustomDate}
              mode="datetime"
              display="spinner"
              onChange={handleCustomDateChange}
              minimumDate={new Date()}
              textColor="#fff"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowCustomDateModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={saveCustomDate}
              >
                <Text style={styles.modalButtonTextPrimary}>Add Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  eventFormCard: {
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
  eventFormTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  uploadProgress: {
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  uploadProgressTitle: {
    color: '#4fc3f7',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4fc3f7',
    borderRadius: 3,
  },
  uploadProgressSubtext: {
    color: 'rgba(79, 195, 247, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  uploadError: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  uploadErrorTitle: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  uploadErrorText: {
    color: 'rgba(255, 107, 107, 0.9)',
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
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
  multilineInput: {
    minHeight: 100,
    paddingTop: 16,
  },
  characterCount: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '500',
    marginTop: 6,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  interestChipSelected: {
    backgroundColor: '#4a9b8e',
  },
  interestChipText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  interestChipTextSelected: {
    color: '#fff',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  datePickerText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceOption: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  recurrenceOptionSelected: {
    backgroundColor: '#4a9b8e',
  },
  recurrenceOptionText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  recurrenceOptionTextSelected: {
    color: '#fff',
  },
  customDatesContainer: {
    gap: 8,
    marginBottom: 12,
  },
  customDateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  customDateText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  addDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 155, 142, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 155, 142, 0.3)',
    gap: 8,
  },
  addDateButtonText: {
    color: '#4a9b8e',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(40,40,40,0.95)',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalButtonPrimary: {
    backgroundColor: '#4fc3f7',
    borderColor: '#4fc3f7',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});