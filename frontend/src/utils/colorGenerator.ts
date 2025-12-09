/**
 * Generate distinct colors for routes
 */
const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Orange
  '#52BE80', // Green
  '#EC7063', // Coral
  '#5DADE2', // Light Blue
  '#F1948A', // Pink
  '#82E0AA', // Light Green
  '#F4D03F', // Gold
  '#AED6F1', // Powder Blue
];

export function generateRouteColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * Generate a consistent color for a route based on its name
 * This ensures all directions of the same route (e.g., "100" Morning and "100" Afternoon) get the same color
 * @param routeName The route name (e.g., "100")
 * @returns A color from the COLORS array
 */
export function generateRouteColorByName(routeName: string): string {
  // Simple hash function: sum character codes to get a consistent index
  let hash = 0;
  for (let i = 0; i < routeName.length; i++) {
    hash += routeName.charCodeAt(i);
  }
  // Use absolute value and modulo to get a valid index
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}




