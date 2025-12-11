/**
 * Generate distinct colors for routes
 * Pleasant pastel palette with 40 unique colors, slightly darker for better visibility
 */
const COLORS = [
  '#7FC4A8', // Soft Mint
  '#8FA8D4', // Lavender Blue
  '#E89AA8', // Blush Pink
  '#F4B87A', // Peach
  '#9BC89A', // Sage Green
  '#B89AD4', // Lavender
  '#F4D49A', // Apricot
  '#8FC48F', // Light Green
  '#D4B89A', // Beige
  '#9AA8D4', // Sky Blue
  '#E0A8B0', // Rose
  '#B8D4B8', // Pale Green
  '#D4A89A', // Coral
  '#8FB8D4', // Powder Blue
  '#D4B8A8', // Sand
  '#A8D4B8', // Mint
  '#B8A8D4', // Periwinkle
  '#D49AA8', // Pink
  '#8FD4B8', // Seafoam
  '#B8D4A8', // Lime
  '#D4B8B8', // Dusty Rose
  '#A89AD4', // Lilac
  '#D4A8B8', // Mauve
  '#7FA8C4', // Baby Blue
  '#B8D49A', // Chartreuse
  '#D49AB8', // Orchid
  '#9AD4B8', // Aqua
  '#B89AA8', // Lavender Grey
  '#A8A8D4', // Cornflower
  '#C4B89A', // Cream
  '#A8B8D4', // Ice Blue
  '#C8A8D4', // Wisteria
  '#8FD4A8', // Mint Green
  '#D4A8A8', // Blush
  '#7FA8B8', // Periwinkle Blue
  '#A8D49A', // Light Lime
  '#E0B0A8', // Peach Blush
  '#A8D4D4', // Aqua Blue
  '#D4B8D4', // Lavender Pink
  '#B8D4D4', // Pale Blue
];

export function generateRouteColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * Generate a consistent color for a route based on its unique ID
 * This ensures each route (including different directions) gets a unique color
 * @param routeId The unique route ID
 * @returns A color from the COLORS array
 */
export function generateRouteColorById(routeId: string): string {
  // Simple hash function: sum character codes to get a consistent index
  let hash = 0;
  for (let i = 0; i < routeId.length; i++) {
    hash += routeId.charCodeAt(i);
  }
  // Use absolute value and modulo to get a valid index
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

/**
 * Assign unique colors to a list of routes, ensuring no color reuse
 * @param routes Array of routes with IDs
 * @returns Map of route ID to color
 */
export function assignUniqueColors(routes: Array<{ id: string }>): Map<string, string> {
  const colorMap = new Map<string, string>();
  const usedColors = new Set<string>();
  const usedIndices = new Set<number>();
  
  // First pass: assign colors using hash function
  routes.forEach(route => {
    const color = generateRouteColorById(route.id);
    const hash = Array.from(route.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = Math.abs(hash) % COLORS.length;
    
    // If color is already used, find next available color
    if (usedColors.has(color)) {
      // Find next unused color
      let newIndex = (index + 1) % COLORS.length;
      let attempts = 0;
      while (usedColors.has(COLORS[newIndex]) && attempts < COLORS.length) {
        newIndex = (newIndex + 1) % COLORS.length;
        attempts++;
      }
      const newColor = COLORS[newIndex];
      colorMap.set(route.id, newColor);
      usedColors.add(newColor);
      usedIndices.add(newIndex);
    } else {
      colorMap.set(route.id, color);
      usedColors.add(color);
      usedIndices.add(index);
    }
  });
  
  return colorMap;
}

/**
 * Generate a consistent color for a route based on its name
 * This ensures all directions of the same route (e.g., "100" Morning and "100" Afternoon) get the same color
 * @param routeName The route name (e.g., "100")
 * @returns A color from the COLORS array
 * @deprecated Use generateRouteColorById instead to ensure unique colors per route
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




