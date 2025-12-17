# Street Highlighting Improvement Proposal

## Current Problems

1. **Loose Regex Matching**: Case-insensitive partial matching can return incorrect streets (e.g., "Patton" matches "Patton Street", "Patton Road", etc.)

2. **Unordered Segments**: Street segments from OSM are concatenated without proper ordering, creating disconnected lines

3. **No Validation**: Doesn't verify that matched street names actually correspond to the requested street

4. **No Highway Filtering**: May include footpaths, cycleways, and other non-street highways

5. **Poor Directional Handling**: Directional prefixes aren't properly matched or validated

## Proposed Solution

### 1. **Precise Name Matching**
   - Normalize both the query and OSM street names for comparison
   - Match full street names, not partial strings
   - Handle variations (e.g., "SW Patton Rd" = "Southwest Patton Road" = "SW Patton Road")
   - Validate that the matched name actually corresponds to the requested street

### 2. **Connect Way Segments**
   - Streets in OSM are split into multiple "way" elements
   - Use a graph algorithm to connect segments that share nodes
   - Order coordinates to form continuous paths
   - Handle disconnected segments (e.g., a street that crosses a river)

### 3. **Filter Highway Types**
   - Only include actual streets: `highway=primary`, `highway=secondary`, `highway=tertiary`, `highway=residential`, `highway=unclassified`, `highway=service`
   - Exclude: `highway=footway`, `highway=cycleway`, `highway=path`, `highway=track`, etc.

### 4. **Better Query Strategy**
   - Try multiple query variations:
     - Full expanded name: "Southwest Patton Road"
     - With directional: "SW Patton Road"
     - Without directional: "Patton Road" (if directional was in query)
   - Use exact name matching first, fall back to regex only if needed
   - Prioritize matches that include the directional prefix

### 5. **Coordinate Ordering**
   - Build a graph of way segments connected by shared nodes
   - Traverse the graph to create ordered coordinate sequences
   - Handle multiple disconnected segments (show all, but properly ordered)

## Implementation Approach

### Step 1: Normalize Street Names
```typescript
function normalizeStreetName(name: string): {
  directional: string | null;
  baseName: string;
  streetType: string | null;
  fullNormalized: string;
}
```

### Step 2: Build Street Graph
```typescript
interface WaySegment {
  id: number;
  coordinates: [number, number][];
  name: string;
  nodes: number[]; // OSM node IDs
}

function buildStreetGraph(ways: WaySegment[]): {
  segments: [number, number][][]; // Ordered coordinate sequences
  disconnected: boolean; // True if street has disconnected parts
}
```

### Step 3: Improved Overpass Query
```typescript
// Query with:
// 1. Exact name match (case-insensitive)
// 2. Filter by highway type (only streets)
// 3. Include node IDs for connecting segments
// 4. Multiple name variations
```

### Step 4: Validate Matches
```typescript
function validateStreetMatch(osmName: string, requestedName: string): boolean {
  // Normalize both and compare
  // Check if directional matches (if present in request)
  // Check if street type matches (if present in request)
}
```

## Benefits

1. **Accuracy**: Only highlights the actual requested street
2. **Completeness**: Shows the entire street, properly connected
3. **Performance**: More efficient queries with better filtering
4. **User Experience**: Clear, accurate highlighting that matches expectations

## Alternative: Simpler Approach

If the full solution is too complex, we could:

1. **Use Nominatim for street lookup first**: Get the exact OSM way ID
2. **Query Overpass for that specific way and connected ways**: More precise
3. **Use OSM's relation system**: Many streets are organized as relations

This would be simpler but might miss some street segments.









