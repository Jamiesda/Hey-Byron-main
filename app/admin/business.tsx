// app/admin/business.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { Business } from '../../data/businesses';

export default function BusinessAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [tags, setTags] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Load existing business data for editing
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission to access gallery is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, // Reduced from 0.7
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Business name is required');
      return;
    }
    setLoading(true);
    try {
      const newBiz: Business = {
        id: Date.now().toString(),
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()) : [],
        socialLinks: socialLinks.trim() 
          ? socialLinks.split(',').map(s => s.trim()) 
          : [],
        image: imageUri || undefined,
      };
      const stored = await AsyncStorage.getItem('businesses') || '[]';
      const list: Business[] = JSON.parse(stored);
      const updated = list.filter(b => b.id !== newBiz.id);
      updated.push(newBiz);
      await AsyncStorage.setItem('businesses', JSON.stringify(updated));
      Alert.alert('Business saved successfully');
      router.back();
    } catch (error) {
      Alert.alert('Error saving business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Button title="Back" onPress={() => router.back()} />
        <ScrollView contentContainerStyle={styles.form}>
          {/* Business Name */}
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter business name"
            maxLength={100}
          />
          <Text style={styles.characterCount}>
            {name.length}/100 characters
          </Text>

          {/* Address */}
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            maxLength={200}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            multiline
            maxLength={2500}
          />
          <Text style={styles.characterCount}>
            {description.length}/2,500 characters
          </Text>

          {/* Tags */}
          <Text style={styles.label}>Tags (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="e.g. cafe, yoga, shop"
            maxLength={200}
          />

          {/* Website */}
          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://"
            maxLength={200}
          />

          {/* Social Links */}
          <Text style={styles.label}>Social Links (comma-separated URLs)</Text>
          <TextInput
            style={styles.input}
            value={socialLinks}
            onChangeText={setSocialLinks}
            placeholder="https://facebook.com/..., https://instagram.com/..."
            maxLength={500}
          />

          {/* Image */}
          <Text style={styles.label}>Image</Text>
          <Button title="Pick Image" onPress={pickImage} />

          {/* Save Button */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            <Button title="Save Business" onPress={handleSave} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { 
    flex: 1, 
    backgroundColor: '#121212' // Dark background to match your theme
  },
  container: { flex: 1 },
  form: { padding: 20 },
  label: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginTop: 10,
    color: '#FFFFFF' // White text on dark background
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#333333', 
    borderRadius: 5, 
    padding: 10, 
    marginTop: 5,
    marginBottom: 8,
    backgroundColor: '#1E1E1E', // Dark input background
    color: '#FFFFFF' // White text in inputs
  },
  characterCount: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginBottom: 8,
  },
});