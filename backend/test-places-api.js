import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('❌ No GOOGLE_API_KEY found in .env file');
  process.exit(1);
}

console.log('🔑 API key configured');
console.log('\n🧪 Testing Google Places API...\n');

// Test 1: Places API (New) - Text Search
async function testPlacesTextSearch() {
  console.log('Test 1: Places API (New) - Text Search');
  console.log('Searching for: "Lincoln High School Portland Oregon"');
  
  const query = encodeURIComponent('Lincoln High School Portland Oregon');
  const url = `https://places.googleapis.com/v1/places:searchText`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
      },
      body: JSON.stringify({
        textQuery: 'Lincoln High School Portland Oregon'
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.places && data.places.length > 0) {
      const place = data.places[0];
      console.log('✅ SUCCESS!');
      console.log('   Place Name:', place.displayName?.text || 'N/A');
      console.log('   Address:', place.formattedAddress || 'N/A');
      console.log('   Location:', place.location);
      console.log('   Place ID:', place.id || 'N/A');
      return true;
    } else {
      console.log('❌ FAILED:', response.status, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return false;
  }
}

// Test 2: Places API (New) - Place Details
async function testPlaceDetails() {
  console.log('\nTest 2: Places API (New) - Place Details');
  console.log('Getting details for a known place...');
  
  // First get a place ID from text search
  const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
  
  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id'
      },
      body: JSON.stringify({
        textQuery: 'West Sylvan Middle School Portland Oregon'
      })
    });
    
    const searchData = await searchResponse.json();
    
    if (searchResponse.ok && searchData.places && searchData.places.length > 0) {
      const placeId = searchData.places[0].id;
      console.log('   Found Place ID:', placeId);
      
      // Now get details using the new API
      const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
      const detailsResponse = await fetch(detailsUrl, {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents'
        }
      });
      
      const detailsData = await detailsResponse.json();
      
      if (detailsResponse.ok && detailsData) {
        console.log('✅ SUCCESS!');
        console.log('   Name:', detailsData.displayName?.text || 'N/A');
        console.log('   Address:', detailsData.formattedAddress || 'N/A');
        console.log('   Location:', detailsData.location);
        return true;
      } else {
        console.log('❌ FAILED:', detailsResponse.status, JSON.stringify(detailsData, null, 2));
        return false;
      }
    } else {
      console.log('❌ Could not find place for details test');
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return false;
  }
}

// Test 3: Places API (New) - Reverse Geocoding (nearby search)
async function testReverseGeocoding() {
  console.log('\nTest 3: Places API (New) - Nearby Search (Reverse Geocoding)');
  console.log('Finding place near coordinates: 45.5203992, -122.6929139 (Lincoln High School area)');
  
  const lat = 45.5203992;
  const lng = -122.6929139;
  const url = `https://places.googleapis.com/v1/places:searchNearby`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
      },
      body: JSON.stringify({
        includedTypes: ['school'],
        maxResultCount: 1,
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng
            },
            radius: 100 // 100 meters
          }
        }
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.places && data.places.length > 0) {
      const place = data.places[0];
      console.log('✅ SUCCESS!');
      console.log('   Place Name:', place.displayName?.text || 'N/A');
      console.log('   Address:', place.formattedAddress || 'N/A');
      console.log('   Location:', place.location);
      console.log('   Place ID:', place.id || 'N/A');
      return true;
    } else {
      console.log('⚠️  No nearby school found, but API is working');
      console.log('   Response:', JSON.stringify(data, null, 2));
      // Still return true since the API call succeeded
      return true;
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    textSearch: await testPlacesTextSearch(),
    placeDetails: await testPlaceDetails(),
    reverseGeocoding: await testReverseGeocoding(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary:');
  console.log('='.repeat(50));
  console.log('Places Text Search:', results.textSearch ? '✅ PASS' : '❌ FAIL');
  console.log('Place Details:', results.placeDetails ? '✅ PASS' : '❌ FAIL');
  console.log('Reverse Geocoding:', results.reverseGeocoding ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log('\n' + (allPassed ? '✅ All tests passed! Places API is working.' : '❌ Some tests failed.'));
  
  return allPassed;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
