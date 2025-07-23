// firebaseConfig.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqyJZtbzHwvL-tIs8rfiOTpJ9gxZTTeGk",
  authDomain: "hey-byron-d7158.firebaseapp.com",
  projectId: "hey-byron-d7158",
  storageBucket: "hey-byron-d7158.firebasestorage.app",
  messagingSenderId: "231910089517",
  appId: "1:231910089517:ios:bf1713f46b1b25d60e69a4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export default app;