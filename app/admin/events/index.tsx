// app/admin/events/index.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Event } from '../../../data/events';

export default function EventsAdmin() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const stored = await AsyncStorage.getItem('events');
      setEvents(stored ? JSON.parse(stored) : []);
    }
    loadEvents();
  }, []);

  const handleCreate = () => {
    router.push({ pathname: './create' });
  };

  const renderItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: './edit', params: { id: item.id } })}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text>{new Date(item.date).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Button title="Create New Event" onPress={handleCreate} />
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  list: { marginTop: 20 },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold' },
});
