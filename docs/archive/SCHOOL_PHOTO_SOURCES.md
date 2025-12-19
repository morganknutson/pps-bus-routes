# School Photo Sources

This document outlines the various sources available for fetching school photos.

## Current Implementation

The `scripts/fetch-school-photos-multi-source.js` script fetches photos from multiple sources:

### 1. Google Places API ✅ (Currently Working)
- **Source**: Google Places API
- **Coverage**: Only 3 schools (7 photos total)
- **Pros**: High quality, official photos
- **Cons**: Very limited coverage
- **API Key Required**: Yes (GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY)

### 2. Wikipedia API ✅ (Implemented)
- **Source**: Wikipedia articles about schools
- **Coverage**: Depends on whether school has Wikipedia page
- **Pros**: Free, no API key needed, historical photos
- **Cons**: Not all schools have Wikipedia pages
- **API Key Required**: No

### 3. Google Street View Static API ✅ (Implemented)
- **Source**: Google Street View images of school buildings
- **Coverage**: Should work for most schools with valid addresses
- **Pros**: Always available for buildings with Street View coverage
- **Cons**: Exterior building photos only, not always the best angle
- **API Key Required**: Yes (GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY)

### 4. Google Custom Search API ⚠️ (Optional - Requires Setup)
- **Source**: Google Image Search
- **Coverage**: Potentially high if configured
- **Pros**: Can find many images from various sources
- **Cons**: Requires API key and Custom Search Engine setup, may have licensing issues
- **API Key Required**: Yes (GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID)

## Additional Sources (Not Yet Implemented)

### 5. Bing Image Search API
- **Source**: Microsoft Bing Image Search
- **Coverage**: High
- **Pros**: Free tier available (3,000 queries/month), good results
- **Cons**: Requires API key
- **API Key Required**: Yes
- **Setup**: https://www.microsoft.com/en-us/bing/apis/bing-image-search-api

### 6. School Websites
- **Source**: Official school websites
- **Coverage**: Varies by school
- **Pros**: Official photos, usually high quality
- **Cons**: Requires web scraping, different structure per school
- **Implementation**: Would need to scrape school websites or use their APIs if available

### 7. PPS School Pages
- **Source**: PPS Google Sites pages (schoolPageLink)
- **Coverage**: All schools have these pages
- **Pros**: Official district photos
- **Cons**: Requires parsing Google Sites, may have limited photos
- **Implementation**: Could scrape the schoolPageLink URLs

### 8. Flickr API
- **Source**: Flickr photos tagged with school name
- **Coverage**: Varies
- **Pros**: Creative Commons licensed photos available
- **Cons**: Requires API key, may have licensing restrictions
- **API Key Required**: Yes
- **Setup**: https://www.flickr.com/services/api/

### 9. Unsplash/Pexels
- **Source**: Free stock photo libraries
- **Coverage**: Very low (generic school photos only)
- **Pros**: Free, high quality
- **Cons**: Won't have specific school photos
- **Not Recommended**: For specific school photos

## Recommended Approach

1. **Start with implemented sources** (Places, Wikipedia, Street View)
2. **Add Bing Image Search** for better coverage (free tier)
3. **Consider school website scraping** for official photos
4. **Use Google Custom Search** if you need more comprehensive results

## Usage

### Basic (Places, Wikipedia, Street View)
```bash
node scripts/fetch-school-photos-multi-source.js
```

### With Google Custom Search (requires setup)
1. Get Google Custom Search API key: https://developers.google.com/custom-search/v1/overview
2. Create a Custom Search Engine: https://programmablesearchengine.google.com/
3. Add to `backend/.env`:
   ```
   GOOGLE_CUSTOM_SEARCH_API_KEY=your_key_here
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id_here
   ```
4. Run the script

## Expected Results

With current implementation (Places + Wikipedia + Street View):
- **Street View**: Should work for most schools (exterior building photos)
- **Wikipedia**: Depends on school having Wikipedia page (maybe 10-20 schools)
- **Places**: Only 3 schools currently
- **Total**: Expect 50-70% of schools to have at least one photo

## Data Structure

Photos are stored in `data/school-photos.json` with the following structure:

```json
{
  "school-id": {
    "schoolId": "school-id",
    "schoolName": "School Name",
    "placeId": "ChIJ...",
    "photos": [
      {
        "source": "street_view",
        "url": "https://...",
        "width": 800,
        "height": 600,
        ...
      }
    ],
    "photoCount": 1,
    "sources": ["street_view"],
    "lastUpdated": "2025-12-17T..."
  }
}
```

Each photo includes a `source` field indicating where it came from.



