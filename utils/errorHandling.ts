// utils/errorHandling.ts
// Error handling helper functions only (no React components)

// Enhanced error detection helper
export const isConnectionError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('offline') ||
    errorCode.includes('network') ||
    errorCode.includes('unavailable') ||
    errorCode === 'auth/network-request-failed'
  );
};

// Improved error message helper
export const getErrorMessage = (error: any, operation: string): string => {
  if (isConnectionError(error)) {
    return `Could not ${operation}. Please check your connection and try again.`;
  }
  
  // Generic fallback for other errors
  return `Failed to ${operation}. Please try again.`;
};

// Enhanced Firebase error handler
export const handleFirebaseError = (error: any): string => {
  console.error('Firebase Error:', error);
  
  // Network errors
  if (error.code === 'unavailable' || error.message?.includes('network')) {
    return 'No internet connection. Please check your connection and try again.';
  }
  
  // Permission errors
  if (error.code === 'permission-denied') {
    return 'Access denied. Please check your permissions.';
  }
  
  // Not found errors
  if (error.code === 'not-found') {
    return 'Requested data not found. It may have been deleted.';
  }
  
  // Generic Firebase errors
  if (error.code) {
    return `Service temporarily unavailable (${error.code}). Please try again later.`;
  }
  
  // Unknown errors
  return 'Something went wrong. Please try again later.';
};