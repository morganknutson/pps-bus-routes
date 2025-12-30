/**
 * Extract effective date from PDF filename
 * Pattern: {ROUTE}[CODE]-{DIRECTION}_effective_{MMDDYY}.pdf
 * @param filename - PDF filename
 * @returns Date object or null if not found
 */
export function extractEffectiveDateFromFilename(filename: string | undefined | null): Date | null {
  if (!filename) return null;
  
  // Pattern: _effective_{MMDDYY}.pdf
  const match = filename.match(/_effective_(\d{6})\.pdf$/i);
  if (!match) return null;
  
  const dateStr = match[1]; // MMDDYY format
  const month = parseInt(dateStr.substring(0, 2), 10);
  const day = parseInt(dateStr.substring(2, 4), 10);
  const year = parseInt(dateStr.substring(4, 6), 10);
  
  // Convert 2-digit year to 4-digit (assume 2000-2099)
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  
  // Create date (month is 0-indexed in JavaScript Date)
  const date = new Date(fullYear, month - 1, day);
  
  // Validate date
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Format date as "January 1st, 2026"
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatEffectiveDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (n: number): string => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

/**
 * Check if a date is in the future (after today)
 * @param date - Date object
 * @returns true if date is in the future
 */
export function isFutureDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate > today;
}

