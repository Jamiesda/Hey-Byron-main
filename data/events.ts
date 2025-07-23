// app/data/events.ts

/**
 * Event interface - created by businesses and displayed in the app feed
 */
export interface Event {
  id: string;
  businessId: string;
  title: string;
  caption?: string;      // Optional event description
  date: string;          // ISO date-time string
  link?: string;         // Optional external URL
  tags: string[];        // Tags for filtering by user interests
  image?: string;        // Optional image URI
  video?: string;        // Optional video URI
}