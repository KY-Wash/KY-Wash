/**
 * Malaysian Timezone Utilities
 * Converts timestamps to Malaysia Standard Time (Asia/Kuala_Lumpur, UTC+8)
 */

const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Format a date to Malaysian Time string (HH:MM:SS)
 * @param date Date object or timestamp in milliseconds
 * @returns Formatted time string in 12-hour format with AM/PM
 */
export const formatTimeToMalaysianTZ = (date: Date | number): string => {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  try {
    return dateObj.toLocaleTimeString('en-MY', {
      timeZone: MALAYSIA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting time to Malaysian TZ:', error);
    return dateObj.toLocaleTimeString();
  }
};

/**
 * Format a date to Malaysian Date string (DD/MM/YYYY)
 * @param date Date object or timestamp in milliseconds
 * @returns Formatted date string
 */
export const formatDateToMalaysianTZ = (date: Date | number): string => {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  try {
    return dateObj.toLocaleDateString('en-MY', {
      timeZone: MALAYSIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting date to Malaysian TZ:', error);
    return dateObj.toLocaleDateString();
  }
};

/**
 * Format both date and time together in Malaysian timezone
 * @param date Date object or timestamp in milliseconds
 * @returns Formatted date and time string
 */
export const formatDateTimeToMalaysianTZ = (date: Date | number): { date: string; time: string } => {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  return {
    date: formatDateToMalaysianTZ(dateObj),
    time: formatTimeToMalaysianTZ(dateObj),
  };
};

/**
 * Get current Malaysian time
 * @returns Formatted current time in Malaysian timezone
 */
export const getCurrentMalaysianTime = (): string => {
  return formatTimeToMalaysianTZ(new Date());
};

/**
 * Get current Malaysian date
 * @returns Formatted current date in Malaysian timezone
 */
export const getCurrentMalaysianDate = (): string => {
  return formatDateToMalaysianTZ(new Date());
};
