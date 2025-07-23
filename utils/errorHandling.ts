// utils/errorHandling.ts
// Extracted error handling utilities from dashboard.tsx

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