# Geocoding Issues and Solutions

## Problem Identified

When parsing bus route PDFs, we discovered that multiple stops at different intersections were being geocoded to the exact same coordinates. This happens because:

1. **Intersection geocoding limitations**: The OpenStreetMap Nominatim geocoding service doesn't reliably find intersections when using formats like "SW Patton Rd & SW Montgomery Dr"

2. **Fallback behavior**: When intersection geocoding fails, the code falls back to geocoding just the first street (e.g., "SW Patton Rd"), which returns a generic location for that street

3. **Result**: All intersections on the same street get the same coordinates

## Example

In route `100SYL-A_effective_082625.json`, we found:
- 4 stops all at `[-122.7098054, 45.503447]`:
  - SW PATTON RD & SW MONTGOMERY DR [NE]
  - SW PATTON RD & SW HOMAR AV [N]
  - SW PATTON RD & SW ENGLISH LN [NE]
  - SW PATTON RD & SW PATTON CT [N]

- 2 stops at `[-122.7064329, 45.4945913]`:
  - SW FAIRMOUNT BLVD & SW SHERWOOD PL [W]
  - SW FAIRMOUNT BLVD & SW MCDONNELL TERR [W]

## Solution Implemented

### 1. Enhanced Intersection Geocoding
- Try multiple formats for intersections:
  - `Street1 & Street2`
  - `Street1 and Street2`
  - `Street1 at Street2`
  - `Street1, Street2`
  - `corner of Street1 and Street2`
  - `intersection Street1 Street2`
  - `Street1 / Street2`

### 2. Fallback Strategy
- If all intersection formats fail, geocode both streets separately
- Calculate midpoint between the two street locations
- Mark as "approximate" since the actual intersection may not be at the midpoint

### 3. Duplicate Detection
- After geocoding all stops, check for duplicate coordinates
- Warn the user about potential issues
- Flag approximate locations in the data

### 4. Data Flags
- Added `isApproximate` flag to indicate when a location is estimated
- Added `geocodeWarning` field to explain why a location is approximate

## Files Updated

- `scripts/process-single-pdf.js` - Enhanced geocoding logic
- `backend/services/schedulerService.js` - Should be updated with same logic

## Recommendations

1. **Manual verification**: For routes with duplicate coordinates, manually verify the actual intersection locations

2. **Alternative geocoding services**: Consider using services that handle intersections better:
   - Google Maps Geocoding API (requires API key)
   - Mapbox Geocoding API (requires API key)
   - Pelias (open source, self-hosted)

3. **Intersection database**: Consider maintaining a database of known intersections with verified coordinates

4. **User feedback**: Allow users to report incorrect locations and manually correct them

## Testing

To test the improvements, re-run the PDF processing:

```bash
node scripts/process-single-pdf.js data/pdfs/100SYL-A_effective_082625.pdf
```

The script will now:
- Try multiple intersection formats
- Warn about duplicate coordinates
- Flag approximate locations







