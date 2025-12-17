# Routing & Street Highlighting Improvement Proposal
## Using Google Maps APIs for Accurate Routes and Street Geometry

## Current Situation

### Problems with Current Implementation

#### 1. Route Calculation (OSRM)
- **External Dependency**: Uses public OSRM server (`router.project-osrm.org`) which can be unreliable
- **No Traffic Data**: Routes don't account for real-world traffic patterns
- **Rate Limiting**: Public server may throttle or block requests
- **No Street-Level Accuracy**: Routes may not perfectly follow actual streets
- **Fallback Issues**: Falls back to straight lines when OSRM fails

#### 2. Street Highlighting (OpenStreetMap Overpass)
- **Complex Queries**: Requires complex Overpass QL queries
- **Name Matching Issues**: Loose regex matching can return wrong streets
- **Disconnected Segments**: Street segments aren't properly connected
- **No Validation**: Doesn't verify matched streets are correct
- **Performance**: Slow queries, especially for long streets
- **Reliability**: Public Overpass servers can be unreliable

#### 3. Street Geometry Issues
- **Incomplete Coverage**: May miss street segments
- **Coordinate Ordering**: Segments not properly ordered
- **No Directional Validation**: Doesn't properly handle directional prefixes

---

## Google Maps API Options

### Option 1: Directions API (Recommended for Routes)
**Best for**: Calculating routes between multiple waypoints (bus stops)

**Features**:
- **Accurate Routing**: Uses Google's routing engine with traffic data
- **Multiple Waypoints**: Supports up to 25 waypoints per request
- **Polyline Encoding**: Returns encoded polylines for efficient storage
- **Traffic-Aware**: Can include real-time traffic in routing
- **Multiple Travel Modes**: Driving, walking, bicycling, transit
- **Route Optimization**: Can optimize waypoint order

**Pricing**:
- **Free Tier**: $200/month credit (covers ~40,000 requests)
- **After Free Tier**: $5.00 per 1,000 requests
- **Your Usage**: ~600-800 route calculations upfront, then ~10-50/month
- **Cost**: Effectively free with $200 credit

**API Endpoint**:
```
https://maps.googleapis.com/maps/api/directions/json
```

**Request Example**:
```javascript
// Calculate route through multiple stops
const url = `https://maps.googleapis.com/maps/api/directions/json?` +
  `origin=${startLat},${startLng}&` +
  `destination=${endLat},${endLng}&` +
  `waypoints=${waypoints.join('|')}&` +
  `key=${API_KEY}`;
```

**Response**:
- Encoded polyline geometry
- Distance and duration
- Step-by-step directions
- Route alternatives (optional)

**Strengths**:
- ✅ Accurate, street-following routes
- ✅ Handles multiple waypoints efficiently
- ✅ Traffic-aware routing
- ✅ Reliable and fast
- ✅ Well-documented

**Limitations**:
- Requires API key
- Costs money after free tier (but you have credits)
- 25 waypoint limit per request (can batch if needed)

---

### Option 2: Roads API - Snap to Roads
**Best for**: Snapping coordinates to nearest road and getting road geometry

**Features**:
- **Snap to Roads**: Corrects GPS coordinates to nearest road
- **Road Geometry**: Returns polyline of the road segment
- **Speed Limits**: Can return speed limit data
- **Place IDs**: Returns Google Place IDs for roads

**Pricing**:
- **Free Tier**: $200/month credit
- **After Free Tier**: $10.00 per 1,000 requests
- **More expensive** than Directions API

**API Endpoint**:
```
https://roads.googleapis.com/v1/snapToRoads
https://roads.googleapis.com/v1/nearestRoads
```

**Use Cases**:
- Snap stop coordinates to nearest road
- Get road geometry for street highlighting
- Validate coordinates are on actual roads

**Strengths**:
- ✅ Accurate road snapping
- ✅ Returns road geometry
- ✅ Validates coordinates

**Limitations**:
- More expensive than Directions API
- Better for point snapping than route calculation
- May not be necessary if using Directions API

---

### Option 3: Places API - Text Search (For Street Finding)
**Best for**: Finding streets by name (replacing Overpass queries)

**Features**:
- **Text Search**: Search for places/streets by name
- **Location Bias**: Restrict results to Portland area
- **Place Details**: Returns geometry and place information
- **Address Components**: Returns structured address data

**Pricing**:
- **Free Tier**: $200/month credit
- **After Free Tier**: $32 per 1,000 requests
- **More expensive** but more accurate than Overpass

**API Endpoint**:
```
https://places.googleapis.com/v1/places:searchText
```

**Use Cases**:
- Find street by name: "SW Patton Road, Portland, OR"
- Get street geometry from place details
- Validate street names

**Strengths**:
- ✅ Accurate street name matching
- ✅ Returns place geometry
- ✅ Handles name variations well

**Limitations**:
- More expensive than Overpass
- May not return full street geometry (just segments)
- Better for finding specific streets than highlighting entire streets

---

### Option 4: Hybrid Approach (Recommended)
**Best Strategy**: Combine Directions API + Places API

**For Route Calculation**:
- Use **Directions API** to calculate routes between stops
- Handles waypoints efficiently
- Returns accurate, street-following polylines

**For Street Highlighting**:
- Use **Places API** to find streets by name
- Get place details with geometry
- More accurate than Overpass queries

**Benefits**:
- Maximum accuracy for both routes and highlighting
- Cost-effective (mostly free tier)
- Reliable and fast

---

## Recommended Implementation

### Phase 1: Replace OSRM with Directions API
**Priority**: High - Immediate route accuracy improvement

**Changes Needed**:
1. Create `DirectionsService` class in `backend/services/`
2. Replace OSRM calls in:
   - `frontend/src/services/routing.ts`
3. Add `GOOGLE_MAPS_API_KEY` to `.env` (same key as geocoding)

**Implementation Details**:
```javascript
// New DirectionsService class
class DirectionsService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
  }

  async getRoute(waypoints) {
    // waypoints: [[lat, lng], [lat, lng], ...]
    // Convert to Directions API format
    // Handle 25 waypoint limit (batch if needed)
    // Return decoded polyline coordinates
  }

  async getRouteWithTraffic(waypoints, departureTime) {
    // Include traffic data for more accurate routing
  }
}
```

**Benefits**:
- ✅ Accurate, street-following routes
- ✅ Traffic-aware routing (optional)
- ✅ More reliable than public OSRM
- ✅ Better error handling

---

### Phase 2: Replace Overpass with Places API (Optional)
**Priority**: Medium - For street highlighting accuracy

**When to Use**:
- When user wants to highlight a specific street
- For street name validation
- For getting street geometry

**Implementation**:
- Use Places API Text Search to find street
- Get place details with geometry
- Display geometry on map

**Benefits**:
- ✅ More accurate street finding
- ✅ Better name matching
- ✅ Returns validated geometry

**Consideration**:
- May be more expensive than keeping Overpass
- Could keep Overpass as fallback for cost savings

---

### Phase 3: Add Roads API Snapping (Optional)
**Priority**: Low - For coordinate validation

**When to Use**:
- When stop coordinates seem off-road
- For validating geocoded coordinates
- For getting precise road geometry

**Implementation**:
- Snap stop coordinates to nearest road
- Validate coordinates are on actual roads
- Correct coordinates if needed

**Benefits**:
- ✅ Ensures stops are on roads
- ✅ Validates coordinate accuracy
- ✅ Can correct GPS errors

---

## Cost Analysis

### Current (OSRM + Overpass)
- **Cost**: Free (public servers)
- **Reliability**: Variable (public servers can be down)
- **Accuracy**: Good but not perfect
- **Performance**: Slow (rate limiting, complex queries)

### Proposed (Directions API + Places API)
- **Upfront Cost**: $0 (covered by $200/month free credit)
  - 600-800 route requests = ~$0.03-0.04
  - 50-100 street searches = ~$0.02-0.03
  - Total: ~$0.05-0.07 (well within free tier)
- **Ongoing Cost**: ~$0.01-0.05/month
- **Reliability**: High (Google's infrastructure)
- **Accuracy**: Excellent (Google's routing engine)
- **Performance**: Fast (no rate limiting delays)

### Cost Comparison
| Scenario | OSRM + Overpass | Google Directions + Places |
|---------|----------------|---------------------------|
| Initial 600 routes | Free | Free (within credit) |
| Monthly updates (50 routes) | Free | Free (within credit) |
| Street highlighting (100 searches) | Free | Free (within credit) |
| Reliability | Variable | High |
| Accuracy | Good | Excellent |
| Performance | Slow | Fast |

**Conclusion**: Effectively free with much better accuracy and reliability.

---

## Implementation Plan

### Step 1: Set Up Google Cloud Project
1. Use same Google Cloud project as geocoding
2. Enable Directions API
3. Enable Places API (if using for street highlighting)
4. Use same API key (or create separate key for routing)

### Step 2: Create DirectionsService Class
- Location: `backend/services/directionsService.js`
- Follow OOP pattern (class-based service)
- Implement:
  - `getRoute(waypoints)` - Calculate route through waypoints
  - `decodePolyline(encoded)` - Decode Google's polyline format
  - `batchWaypoints(waypoints)` - Handle 25 waypoint limit
  - Error handling and retry logic

### Step 3: Update Frontend Routing Service
- Replace OSRM calls in `frontend/src/services/routing.ts`
- Update to use backend Directions API endpoint
- Keep caching mechanism
- Update polyline decoder for Google format

### Step 4: Create Backend Route Endpoint
- Add `/api/routes/calculate` endpoint
- Accept waypoints array
- Call DirectionsService
- Return route coordinates

### Step 5: Optional - Update Street Highlighting
- Create `PlacesService` for street finding (or extend existing)
- Replace Overpass queries with Places API
- Update `frontend/src/utils/streetGeometry.ts`

### Step 6: Test & Validate
- Test with existing routes
- Verify route accuracy
- Check performance
- Validate cost usage

---

## Expected Improvements

### Route Accuracy
- ✅ **Street-Following Routes**: Routes perfectly follow actual streets
- ✅ **Traffic-Aware**: Can include real-time traffic (optional)
- ✅ **No Straight Lines**: Eliminates fallback to straight lines
- ✅ **Better Visualization**: Routes look more realistic on map

### Reliability
- ✅ **No External Dependencies**: No reliance on public OSRM servers
- ✅ **Consistent Performance**: Google's infrastructure is reliable
- ✅ **Better Error Handling**: Proper error responses and retries

### Street Highlighting (If Using Places API)
- ✅ **Accurate Street Finding**: Better name matching than Overpass
- ✅ **Validated Geometry**: Returns verified street geometry
- ✅ **Faster Queries**: No complex Overpass QL needed

### Performance
- ✅ **Faster Route Calculation**: No rate limiting delays
- ✅ **Efficient Batching**: Can handle multiple waypoints efficiently
- ✅ **Better Caching**: Can cache routes more effectively

---

## Alternative: Keep Overpass for Street Highlighting

**Option**: Use Directions API for routes, but keep Overpass for street highlighting

**Rationale**:
- Street highlighting is less critical than route accuracy
- Overpass is free and works reasonably well
- Can save on Places API costs

**Trade-off**:
- Street highlighting may be less accurate
- But routes will be much more accurate
- Cost savings for street highlighting

**Recommendation**: Start with Directions API for routes, evaluate if Places API is needed for highlighting later.

---

## Risks & Mitigation

### Risk 1: API Key Exposure
**Mitigation**: 
- Store in `.env` file (already in `.gitignore`)
- Restrict API key to specific APIs in Google Cloud Console
- Use environment variables only

### Risk 2: Cost Overruns
**Mitigation**:
- Set up billing alerts in Google Cloud
- Monitor usage in Cloud Console
- Free tier covers 40,000 requests/month (we need ~600-800)
- Implement caching to reduce API calls

### Risk 3: Waypoint Limit
**Mitigation**:
- Directions API supports 25 waypoints per request
- For routes with >25 stops, batch into multiple requests
- Combine results into single route

### Risk 4: API Changes
**Mitigation**:
- Google Maps API is stable and well-maintained
- Version the API calls (use specific API version)
- Keep OSRM as fallback for backward compatibility

---

## Recommendation

**Use Google Maps Directions API** for route calculation:

1. **Immediate Benefits**: 
   - Accurate, street-following routes
   - Traffic-aware routing (optional)
   - More reliable than OSRM

2. **Cost Effective**: 
   - Free tier covers all usage
   - Minimal ongoing costs

3. **Easy Implementation**: 
   - Simple API integration
   - Well-documented
   - Can keep OSRM as fallback

4. **Future-Proof**: 
   - Google maintains and improves the API
   - Better than relying on free public services

**For Street Highlighting**:
- **Option A**: Use Places API for maximum accuracy (more expensive)
- **Option B**: Keep Overpass for cost savings (still free, reasonably accurate)
- **Recommendation**: Start with Option B, upgrade to Option A if needed

---

## Next Steps

1. **Review this proposal** and approve approach
2. **Enable Directions API** in Google Cloud Console
3. **Implement DirectionsService** class
4. **Update routing service** to use Directions API
5. **Test with sample routes**
6. **Replace OSRM calls** in existing code
7. **Monitor usage** and costs
8. **Evaluate** if Places API needed for street highlighting

---

## Questions?

- Should we use Places API for street highlighting, or keep Overpass?
- Do you want traffic-aware routing, or just basic routing?
- Should we keep OSRM as a fallback, or fully replace it?
- Do you want to implement street highlighting improvements now, or focus on routes first?







