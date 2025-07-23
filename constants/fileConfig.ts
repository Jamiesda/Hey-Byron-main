// constants/fileConfig.ts
// Extracted file configuration and media detection utilities from dashboard.tsx

// File size constants - Updated for server-side compression
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;  // 2MB
export const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB (server compression reduces to ~10MB)

// Simple, bulletproof media detection functions
export const isVideo = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.mp4') || 
         lowerUrl.includes('.mov') || 
         lowerUrl.includes('.m4v') ||
         lowerUrl.includes('_compressed');
};

export const isImage = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.jpg') || 
         lowerUrl.includes('.jpeg') || 
         lowerUrl.includes('.png') || 
         lowerUrl.includes('.gif');
}; 