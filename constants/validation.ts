// constants/validation.ts
// Extracted validation functions from dashboard.tsx

import * as Location from 'expo-location';

// Business data validation
export const validateBusinessData = async (businessData: {
  name: string;
  address: string;
  description: string;
  website: string;
  tags: string;
  socialLinks: string;
}) => {
  const errors: string[] = [];

  // Business name validation
  if (!businessData.name.trim()) {
    errors.push("Business name is required");
  } else if (businessData.name.trim().length > 50) {
    errors.push("Business name must be 50 characters or less");
  }

  // Address validation
  if (!businessData.address.trim()) {
    errors.push("Address is required");
  } else {
    // Test if address can be geocoded
    try {
      const geocoded = await Location.geocodeAsync(businessData.address.trim());
      if (!geocoded || geocoded.length === 0) {
        errors.push("Please enter a valid address that can be found on maps");
      }
    } catch (error) {
      errors.push("Unable to verify address. Please check your internet connection and try again");
    }
  }

  // Description validation
  if (!businessData.description.trim()) {
    errors.push("Business description is required");
  } else if (businessData.description.trim().length > 2500) {
    errors.push("Description must be 2,500 characters or less");
  }

  // Website validation (required)
  if (!businessData.website.trim()) {
    errors.push("Website is required");
  } else {
    // More flexible website validation - allow domain names without protocol
    const websiteValue = businessData.website.trim();
    // Check if it's a valid domain format (with or without protocol)
    const domainRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!domainRegex.test(websiteValue)) {
      errors.push("Please enter a valid website (e.g., yourwebsite.com or https://yourwebsite.com)");
    }
  }

  // Tags validation
  if (!businessData.tags.trim()) {
    errors.push("At least one tag is required");
  } else if (businessData.tags.length > 200) {
    errors.push("Tags must be 200 characters or less");
  }

  // Social links validation (optional, but if provided must be valid)
  if (businessData.socialLinks.trim()) {
    if (businessData.socialLinks.length > 500) {
      errors.push("Social links must be 500 characters or less");
    }
    
    // Check if each social link is a valid URL
    const links = businessData.socialLinks.split(',').map(link => link.trim());
    const urlRegex = /^https?:\/\/.+\..+/;
    const invalidLinks = links.filter(link => link && !urlRegex.test(link));
    
    if (invalidLinks.length > 0) {
      errors.push("All social links must be valid URLs (e.g., https://facebook.com/yourpage)");
    }
  }

  return errors;
};

// Event data validation
export const validateEventData = (eventData: {
  title: string;
  caption: string;
  date: Date;
  link: string;
  interests: string[];
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'custom';
  recurrenceCount?: number;
  customDates?: Date[];
}) => {
  const errors: string[] = [];

  // Event title validation
  if (!eventData.title.trim()) {
    errors.push("Event title is required");
  } else if (eventData.title.trim().length > 100) {
    errors.push("Event title must be 100 characters or less");
  }

  // Event description validation (optional)
  if (eventData.caption.trim().length > 300) {
    errors.push("Event description must be 300 characters or less");
  }

  // Date validation (future only)
  const now = new Date();
  if (eventData.date <= now) {
    errors.push("Event date must be in the future");
  }

  // Link validation (optional, but if provided must be valid)
  if (eventData.link.trim()) {
    if (eventData.link.length > 200) {
      errors.push("Event link must be 200 characters or less");
    }
    
    // More flexible link validation - allow domain names without protocol
    const linkValue = eventData.link.trim();
    const domainRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!domainRegex.test(linkValue)) {
      errors.push("Event link must be a valid URL (e.g., tickets.com or https://tickets.com)");
    }
  }

  // Interests validation
  if (!eventData.interests || eventData.interests.length === 0) {
    errors.push("Please select at least one interest category for your event");
  }

  // Recurring events validation
  if (eventData.isRecurring) {
    if (!eventData.recurrenceType) {
      errors.push("Please select daily, weekly, or custom repeat frequency");
    }
    
    if (eventData.recurrenceType === 'custom') {
      if (!eventData.customDates || eventData.customDates.length === 0) {
        errors.push("Please select at least one custom date");
      } else if (eventData.customDates.length > 10) {
        errors.push("Maximum 10 custom dates allowed");
      }
      
      // Validate all custom dates are in the future
      const now = new Date();
      const pastDates = eventData.customDates?.filter(date => date <= now) || [];
      if (pastDates.length > 0) {
        errors.push("All custom dates must be in the future");
      }
      
      // Check for duplicate dates
      if (eventData.customDates) {
        const dateStrings = eventData.customDates.map(date => date.toISOString());
        const uniqueDateStrings = [...new Set(dateStrings)];
        if (dateStrings.length !== uniqueDateStrings.length) {
          errors.push("Custom dates cannot have duplicates");
        }
      }
    } else {
      // Daily/Weekly validation
      if (!eventData.recurrenceCount || eventData.recurrenceCount < 1) {
        errors.push("Please specify number of recurring events");
      } else {
        const maxCount = eventData.recurrenceType === 'daily' ? 30 : 10;
        if (eventData.recurrenceCount > maxCount) {
          errors.push(`Maximum ${maxCount} ${eventData.recurrenceType} events allowed`);
        }
      }
    }
  }

  return errors;
};

// Website URL formatting helper
export const formatWebsiteUrl = (website: string): string => {
  if (!website) return website;
  
  // If it already has a protocol, return as-is
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }
  
  // Add https:// prefix for consistency and clickability
  return `https://${website}`;
};

// Validation helper for custom dates
export const validateCustomDates = (dates: Date[]): string[] => {
  const errors: string[] = [];
  const now = new Date();
  
  if (!dates || dates.length === 0) {
    errors.push("Please select at least one custom date");
    return errors;
  }
  
  if (dates.length > 10) {
    errors.push("Maximum 10 custom dates allowed");
  }
  
  // Check for past dates
  const pastDates = dates.filter(date => date <= now);
  if (pastDates.length > 0) {
    errors.push(`${pastDates.length} date(s) cannot be in the past`);
  }
  
  // Check for duplicates
  const dateStrings = dates.map(date => date.toISOString());
  const uniqueDateStrings = [...new Set(dateStrings)];
  if (dateStrings.length !== uniqueDateStrings.length) {
    errors.push("Cannot have duplicate dates and times");
  }
  
  // Check date range (warn if dates span more than 3 months)
  if (dates.length > 1) {
    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 90) {
      errors.push("Custom dates span more than 3 months - consider using weekly repeats instead");
    }
  }
  
  return errors;
};

// Validation helper for recurring patterns
export const validateRecurringPattern = (
  type: 'daily' | 'weekly' | 'custom',
  count?: number,
  customDates?: Date[]
): string[] => {
  const errors: string[] = [];
  
  if (type === 'custom') {
    if (customDates) {
      errors.push(...validateCustomDates(customDates));
    }
  } else {
    if (!count || count < 1) {
      errors.push("Please specify number of recurring events");
    } else {
      const maxCount = type === 'daily' ? 30 : 10;
      if (count > maxCount) {
        errors.push(`Maximum ${maxCount} ${type} events allowed`);
      }
      
      if (count < 2) {
        errors.push("Recurring events must have at least 2 instances (use single event instead)");
      }
    }
  }
  
  return errors;
};

// Helper to validate event dates don't conflict with business hours/constraints
export const validateEventTiming = (date: Date, businessHours?: { open: string; close: string }): string[] => {
  const errors: string[] = [];
  
  // Basic future date validation
  const now = new Date();
  if (date <= now) {
    errors.push("Event date must be in the future");
    return errors;
  }
  
  // Check if date is too far in the future (1 year limit)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (date > oneYearFromNow) {
    errors.push("Event date cannot be more than 1 year in the future");
  }
  
  // Business hours validation (if provided)
  if (businessHours) {
    const eventHour = date.getHours();
    const eventMinute = date.getMinutes();
    const eventTime = eventHour * 60 + eventMinute; // Convert to minutes
    
    const [openHour, openMinute] = businessHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = businessHours.close.split(':').map(Number);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    if (eventTime < openTime || eventTime > closeTime) {
      errors.push(`Event time should be within business hours (${businessHours.open} - ${businessHours.close})`);
    }
  }
  
  return errors;
};

// Comprehensive event validation combining all checks
export const validateCompleteEvent = (eventData: {
  title: string;
  caption: string;
  date: Date;
  link: string;
  interests: string[];
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'custom';
  recurrenceCount?: number;
  customDates?: Date[];
}, businessHours?: { open: string; close: string }): string[] => {
  const errors: string[] = [];
  
  // Basic event validation
  errors.push(...validateEventData(eventData));
  
  // Event timing validation
  errors.push(...validateEventTiming(eventData.date, businessHours));
  
  // Additional recurring validation
  if (eventData.isRecurring && eventData.recurrenceType) {
    errors.push(...validateRecurringPattern(
      eventData.recurrenceType,
      eventData.recurrenceCount,
      eventData.customDates
    ));
    
    // Validate all custom dates if using custom recurrence
    if (eventData.recurrenceType === 'custom' && eventData.customDates) {
      eventData.customDates.forEach((date, index) => {
        const dateErrors = validateEventTiming(date, businessHours);
        dateErrors.forEach(error => {
          errors.push(`Custom date ${index + 1}: ${error}`);
        });
      });
    }
  }
  
  return errors;
};