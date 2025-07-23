// scripts/generateStressTestData.ts - UPDATED with 50% Videos
// @ts-nocheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Business } from '../data/businesses';
import { Event } from '../data/events';

// Sample video URLs with mixed orientations
const SAMPLE_VIDEOS = {
  landscape: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  ],
  portrait: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    // Adding some realistic mobile/portrait style video URLs
    'https://sample-videos.com/zip/10/mp4/SampleVideo_360x640_1mb.mp4',
    'https://sample-videos.com/zip/10/mp4/SampleVideo_480x854_2mb.mp4'
  ]
};

// Sample images for non-video events
const SAMPLE_IMAGES = [
  'https://picsum.photos/800/600?random=1',
  'https://picsum.photos/800/600?random=2',
  'https://picsum.photos/600/800?random=3', // Portrait
  'https://picsum.photos/800/600?random=4',
  'https://picsum.photos/600/800?random=5', // Portrait
  'https://picsum.photos/800/600?random=6',
  'https://picsum.photos/1200/800?random=7',
  'https://picsum.photos/800/1200?random=8', // Portrait
  'https://picsum.photos/800/600?random=9',
  'https://picsum.photos/600/800?random=10' // Portrait
];

const BYRON_BAY_BUSINESSES = [
  {
    name: 'Byron Bay Yoga Studio',
    tags: ['Yoga/Pilates', 'Wellness', 'Fitness'],
    eventTypes: ['Sunrise Yoga', 'Meditation Session', 'Pilates Class', 'Wellness Workshop']
  },
  {
    name: 'The Beach House Cafe',
    tags: ['Food', 'Food & Drink Specials', 'Beer, Wine & Spirits'],
    eventTypes: ['Live Music Brunch', 'Wine Tasting', 'Barista Workshop', 'Sunset Dinner']
  },
  {
    name: 'Nimbin Electronic Collective',
    tags: ['Electronic Music', 'Live Music', 'Art'],
    eventTypes: ['Electronic Night', 'DJ Workshop', 'Sound Healing', 'Ambient Sessions']
  },
  {
    name: 'Byron Arts & Culture',
    tags: ['Art', 'Cultural Events', 'Workshops'],
    eventTypes: ['Art Exhibition', 'Pottery Class', 'Cultural Talk', 'Artist Showcase']
  },
  {
    name: 'Main Beach Surf School',
    tags: ['Surfing', 'Outdoor activities', 'Fitness'],
    eventTypes: ['Surf Lesson', 'Beach Cleanup', 'Surf Competition', 'Ocean Safety Course']
  },
  {
    name: 'The Comedy Cave',
    tags: ['Comedy', 'Live Music', 'Community Events'],
    eventTypes: ['Stand-up Night', 'Open Mic', 'Comedy Workshop', 'Improv Class']
  },
  {
    name: 'Byron Bay Markets',
    tags: ['Markets', 'Food', 'Community Events'],
    eventTypes: ['Farmers Market', 'Artisan Fair', 'Food Festival', 'Craft Workshop']
  },
  {
    name: 'Lighthouse Cinema',
    tags: ['Films', 'Cultural Events', 'Community Events'],
    eventTypes: ['Film Screening', 'Documentary Night', 'Film Discussion', 'Movie Marathon']
  },
  {
    name: 'The Wellness Retreat',
    tags: ['Wellness', 'Yoga/Pilates', 'Workshops'],
    eventTypes: ['Meditation Retreat', 'Breathwork Session', 'Healing Circle', 'Mindfulness Workshop']
  },
  {
    name: 'Byron Bay Brewery',
    tags: ['Beer, Wine & Spirits', 'Live Music', 'Food'],
    eventTypes: ['Beer Tasting', 'Brewery Tour', 'Live Music Night', 'Trivia Night']
  }
];

const generateRandomAddress = () => {
  const streets = ['Jonson St', 'Bay St', 'Butler St', 'Fletcher St', 'Marvel St', 'Bangalow Rd', 'Ewingsdale Rd'];
  const numbers = Math.floor(Math.random() * 200) + 1;
  return `${numbers} ${streets[Math.floor(Math.random() * streets.length)]}, Byron Bay NSW 2481`;
};

const generateRandomDescription = (businessName: string) => {
  const descriptions = [
    `Welcome to ${businessName}, where magic happens every day in beautiful Byron Bay.`,
    `${businessName} has been serving the Byron Bay community with passion and dedication.`,
    `Experience the best of Byron Bay at ${businessName}. Join us for unforgettable moments.`,
    `${businessName} brings together community, creativity, and the Byron Bay spirit.`,
    `Discover something special at ${businessName}, your local Byron Bay destination.`
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
};

const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomDate = () => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000); // Next 30 days
  return futureDate.toISOString();
};

const getRandomMedia = (isVideo: boolean) => {
  if (isVideo) {
    // 60% landscape, 40% portrait for more realistic mix
    const usePortrait = Math.random() < 0.4;
    const videoArray = usePortrait ? SAMPLE_VIDEOS.portrait : SAMPLE_VIDEOS.landscape;
    return {
      video: getRandomElement(videoArray),
      image: undefined
    };
  } else {
    return {
      video: undefined,
      image: getRandomElement(SAMPLE_IMAGES)
    };
  }
};

const generateEventCaption = (eventType: string, businessName: string) => {
  const captions = [
    `Join us for an amazing ${eventType} experience at ${businessName}! Don't miss out on this incredible opportunity to connect with the Byron Bay community.`,
    `${businessName} presents ${eventType} - a unique experience that captures the essence of Byron Bay. Book now to secure your spot!`,
    `Experience the magic of ${eventType} in the heart of Byron Bay. ${businessName} welcomes you to this special event.`,
    `Get ready for ${eventType} at ${businessName}! This is going to be an unforgettable experience in beautiful Byron Bay.`,
    `${businessName} invites you to ${eventType}. Join us for good vibes, great people, and the Byron Bay spirit we all love.`
  ];
  return getRandomElement(captions);
};

export const generateStressTestData = async () => {
  console.log('🚀 Generating stress test data with 50% videos...');
  
  try {
    // Generate 100 businesses
    const businesses: Business[] = [];
    
    for (let i = 0; i < 100; i++) {
      const businessTemplate = getRandomElement(BYRON_BAY_BUSINESSES);
      const businessId = `stress_business_${i + 1}`;
      
      const business: Business = {
        id: businessId,
        name: `${businessTemplate.name} ${i + 1}`,
        address: generateRandomAddress(),
        description: generateRandomDescription(`${businessTemplate.name} ${i + 1}`),
        tags: businessTemplate.tags,
        website: `https://${businessTemplate.name.toLowerCase().replace(/\s+/g, '')}-${i + 1}.com.au`,
        socialLinks: [
          `https://facebook.com/${businessTemplate.name.toLowerCase().replace(/\s+/g, '')}-${i + 1}`,
          `https://instagram.com/${businessTemplate.name.toLowerCase().replace(/\s+/g, '')}-${i + 1}`
        ],
        image: getRandomElement(SAMPLE_IMAGES)
      };
      
      businesses.push(business);
    }
    
    // Generate 500 events (50% videos, 50% images)
    const events: Event[] = [];
    
    for (let i = 0; i < 500; i++) {
      const business = getRandomElement(businesses);
      const businessTemplate = BYRON_BAY_BUSINESSES.find(b => 
        business.name.includes(b.name.split(' ')[0])
      ) || BYRON_BAY_BUSINESSES[0];
      
      const eventType = getRandomElement(businessTemplate.eventTypes);
      const eventId = `stress_event_${i + 1}`;
      
      // 50% chance of video
      const isVideo = Math.random() < 0.5;
      const media = getRandomMedia(isVideo);
      
      const event: Event = {
        id: eventId,
        businessId: business.id,
        title: `${eventType} ${i + 1}`,
        caption: generateEventCaption(eventType, business.name),
        date: getRandomDate(),
        link: `https://eventbrite.com/events/${eventId}`,
        tags: business.tags,
        ...media // Spread video or image
      };
      
      events.push(event);
    }
    
    // Load existing data
    const existingBusinesses = await AsyncStorage.getItem('businesses');
    const existingEvents = await AsyncStorage.getItem('events');
    
    const currentBusinesses: Business[] = existingBusinesses ? JSON.parse(existingBusinesses) : [];
    const currentEvents: Event[] = existingEvents ? JSON.parse(existingEvents) : [];
    
    // Remove any existing stress test data
    const filteredBusinesses = currentBusinesses.filter(b => !b.id.startsWith('stress_business_'));
    const filteredEvents = currentEvents.filter(e => !e.id.startsWith('stress_event_'));
    
    // Add new stress test data
    const updatedBusinesses = [...filteredBusinesses, ...businesses];
    const updatedEvents = [...filteredEvents, ...events];
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('businesses', JSON.stringify(updatedBusinesses));
    await AsyncStorage.setItem('events', JSON.stringify(updatedEvents));
    
    console.log(`✅ Generated ${businesses.length} businesses and ${events.length} events`);
    console.log(`📹 Videos: ${events.filter(e => e.video).length} (${Math.round(events.filter(e => e.video).length / events.length * 100)}%)`);
    console.log(`🖼️ Images: ${events.filter(e => e.image).length} (${Math.round(events.filter(e => e.image).length / events.length * 100)}%)`);
    
    alert(`Successfully generated ${businesses.length} test businesses and ${events.length} test events!\n\n📹 Videos: ${events.filter(e => e.video).length}\n🖼️ Images: ${events.filter(e => e.image).length}`);
    
  } catch (error) {
    console.error('Error generating stress test data:', error);
    alert('Error generating test data. Check console for details.');
  }
};

export const clearStressTestData = async () => {
  console.log('🧹 Clearing stress test data...');
  
  try {
    const existingBusinesses = await AsyncStorage.getItem('businesses');
    const existingEvents = await AsyncStorage.getItem('events');
    
    const currentBusinesses: Business[] = existingBusinesses ? JSON.parse(existingBusinesses) : [];
    const currentEvents: Event[] = existingEvents ? JSON.parse(existingEvents) : [];
    
    // Keep only non-stress-test data
    const filteredBusinesses = currentBusinesses.filter(b => !b.id.startsWith('stress_business_'));
    const filteredEvents = currentEvents.filter(e => !e.id.startsWith('stress_event_'));
    
    await AsyncStorage.setItem('businesses', JSON.stringify(filteredBusinesses));
    await AsyncStorage.setItem('events', JSON.stringify(filteredEvents));
    
    const removedBusinesses = currentBusinesses.length - filteredBusinesses.length;
    const removedEvents = currentEvents.length - filteredEvents.length;
    
    console.log(`✅ Removed ${removedBusinesses} test businesses and ${removedEvents} test events`);
    alert(`Removed ${removedBusinesses} test businesses and ${removedEvents} test events!`);
    
  } catch (error) {
    console.error('Error clearing stress test data:', error);
    alert('Error clearing test data. Check console for details.');
  }
};