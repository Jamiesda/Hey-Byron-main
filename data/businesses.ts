// app/data/businesses.ts - Updated with coordinates for distance calculations

/**
 * Business interface - displayed in the Explore screen
 * UPDATED: Added coordinates for distance calculations
 */
export interface Business {
  id: string;
  name: string;
  address: string;
  description: string;
  website?: string;
  tags: string[];
  socialLinks?: string[];
  image?: string;
  // NEW: Coordinates for distance calculations
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}