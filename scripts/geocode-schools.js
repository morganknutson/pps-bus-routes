/**
 * Script to geocode all school addresses and update schools.json
 * This script looks up each school's address and geocodes it using OpenStreetMap Nominatim
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expandAddressForGeocoding } from '../backend/utils/formatAddress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');

// Mapping of school names to their addresses in Portland, OR
// These addresses are based on Portland Public Schools directory
const SCHOOL_ADDRESSES = {
  'Abernethy': '2421 SE Orange Ave, Portland, OR 97214',
  'ACCESS': '5220 N Kerby Ave, Portland, OR 97217',
  'Ainsworth': '2425 SW Vista Ave, Portland, OR 97201',
  'Alameda': '2732 NE Fremont St, Portland, OR 97212',
  'Arleta': '5109 SE 66th Ave, Portland, OR 97206',
  'Astor': '5601 N Yale St, Portland, OR 97203',
  'Atkinson': '5800 SE Division St, Portland, OR 97206',
  'Beach': '1710 N Humboldt St, Portland, OR 97217',
  'Beaumont': '4045 NE Fremont St, Portland, OR 97212',
  'Benson': '546 NE 12th Ave, Portland, OR 97232',
  'Beverly Cleary': '1915 NE 33rd Ave, Portland, OR 97212',
  'Boise-Eliot': '620 N Fremont St, Portland, OR 97227',
  'Bridger': '7910 SE Market St, Portland, OR 97215',
  'Bridlemile': '4300 SW 47th Dr, Portland, OR 97221',
  'Buckman': '320 SE 16th Ave, Portland, OR 97214',
  'Capitol': '8401 SW 17th Ave, Portland, OR 97219',
  'Cesar Chavez': '5103 N Willis Blvd, Portland, OR 97203',
  'Chapman': '1445 NW 26th Ave, Portland, OR 97210',
  'Chief Joseph': '2409 N Saratoga St, Portland, OR 97217',
  'Clark': '1118 SE 136th Ave, Portland, OR 97233',
  'Creston': '4701 SE Bush St, Portland, OR 97206',
  'DaVinci': '2508 NE Everett St, Portland, OR 97232',
  'Duniway': '7700 SE Reed College Pl, Portland, OR 97202',
  'Faubion': '2930 NE 54th Ave, Portland, OR 97213',
  'Forest Park': '9935 NW Durrett St, Portland, OR 97229',
  'Franklin': '5405 SE Woodward St, Portland, OR 97206',
  'George': '3960 SE 152nd Ave, Portland, OR 97236',
  'Glencoe': '825 SE 51st Ave, Portland, OR 97215',
  'Gray': '6305 SW 54th Ave, Portland, OR 97221',
  'Grout': '3119 SE Holgate Blvd, Portland, OR 97202',
  'Harrison Park': '2225 SE 87th Ave, Portland, OR 97216',
  'Hayhurst': '5037 SW Iowa St, Portland, OR 97221',
  'Hosford': '2303 SE 28th Pl, Portland, OR 97214',
  'Irvington': '1320 NE Brazee St, Portland, OR 97212',
  'Jackson': '10625 SW 35th Ave, Portland, OR 97219',
  'James John': '7439 N Charleston Ave, Portland, OR 97203',
  'Kelly': '9035 SW Barnes Rd, Portland, OR 97225',
  'Kellogg': '3223 SE 20th Ave, Portland, OR 97202',
  'Lane': '7200 SE 60th Ave, Portland, OR 97206',
  'Lee': '2222 NE 92nd Ave, Portland, OR 97220',
  'Lent': '5105 SE 97th Ave, Portland, OR 97266',
  'Leodis V. McDaniel': '2735 NE 82nd Ave, Portland, OR 97220',
  'Lewis': '4401 SE 92nd Ave, Portland, OR 97266',
  'Lincoln': '1600 SW Salmon St, Portland, OR 97205',
  'Llewellyn': '6301 SE 14th Ave, Portland, OR 97202',
  'Dr Martin Luther King': '4906 NE 6th Ave, Portland, OR 97211',
  'Maplewood': '7452 SW 52nd Ave, Portland, OR 97219',
  'Markham': '10531 SW Capitol Hwy, Portland, OR 97219',
  'Marysville': '7730 SE Raymond St, Portland, OR 97206',
  'Mt Tabor': '5800 SE Ash St, Portland, OR 97215',
  'Ockley Green': '6031 N Montana Ave, Portland, OR 97217',
  'Peninsula': '8125 N Emerald Ave, Portland, OR 97217',
  'Richmond': '2276 SE 41st Ave, Portland, OR 97214',
  'Rieke': '1405 SW Vermont St, Portland, OR 97219',
  'Rigler': '5401 NE Prescott St, Portland, OR 97218',
  'Rosa Parks': '8960 N Woolsey Ave, Portland, OR 97203',
  'Rose City Park': '2334 NE 57th Ave, Portland, OR 97213',
  'Roseway Heights': '7334 NE Siskiyou St, Portland, OR 97213',
  'Sabin': '4013 NE 18th Ave, Portland, OR 97212',
  'Scott': '6700 NE Prescott St, Portland, OR 97218',
  'Sellwood': '8300 SE 15th Ave, Portland, OR 97202',
  'Sitton': '9930 N Smith St, Portland, OR 97203',
  'Skyline': '11536 NW Skyline Blvd, Portland, OR 97231',
  'Stephenson': '2627 SW Stephenson St, Portland, OR 97219',
  'Tubman': '2231 N Flint Ave, Portland, OR 97227',
  'Vernon': '2044 NE Killingsworth St, Portland, OR 97211',
  'Vestal': '161 NE 82nd Ave, Portland, OR 97220',
  'West Sylvan': '8111 SW West Slope Dr, Portland, OR 97225',
  'Whitman': '2211 SE 41st Ave, Portland, OR 97214',
  'Woodlawn': '7200 NE Killingsworth St, Portland, OR 97218',
  'Woodmere': '7900 SE Duke St, Portland, OR 97206',
  'Woodstock': '5601 SE 50th Ave, Portland, OR 97206',
};

/**
 * Geocode a single address using OpenStreetMap Nominatim
 */
async function geocodeAddress(address, city = 'Portland', state = 'OR') {
  try {
    // Expand abbreviations for better geocoding
    const expandedAddress = expandAddressForGeocoding(address);
    const cleanedAddress = expandedAddress.replace(/\s*\[([NWES]+)\]\s*/g, '').trim();
    
    // Construct search query
    const query = `${cleanedAddress}, ${city}, ${state}`;
    const encodedQuery = encodeURIComponent(query);

    console.log(`Geocoding: ${address} -> ${query}`);

    // Use Nominatim API (free, rate-limited to 1 request per second)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PPS-Bus-Maps/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding service unavailable: ${response.status}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      console.warn(`No results found for: ${address}`);
      return null;
    }

    const result = data[0];
    const lon = parseFloat(result.lon);
    const lat = parseFloat(result.lat);

    if (isNaN(lon) || isNaN(lat)) {
      console.warn(`Invalid coordinates for ${address}:`, result);
      return null;
    }

    return {
      address: query,
      coordinates: [lon, lat], // [lng, lat] for Leaflet
      displayName: result.display_name,
    };
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error.message);
    return null;
  }
}

/**
 * Main function to geocode all schools
 */
async function geocodeAllSchools() {
  try {
    // Read current schools file
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error(`Schools file not found: ${SCHOOLS_FILE}`);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    console.log(`Found ${schools.length} schools to geocode\n`);

    const updatedSchools = [];
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      const address = SCHOOL_ADDRESSES[school.name];

      if (!address) {
        console.log(`[${i + 1}/${schools.length}] ⚠️  ${school.name}: No address mapping found`);
        updatedSchools.push({
          ...school,
          updatedAt: new Date().toISOString(),
        });
        skipCount++;
        continue;
      }

      // Check if school already has coordinates
      if (school.coordinates && Array.isArray(school.coordinates) && school.coordinates.length === 2) {
        console.log(`[${i + 1}/${schools.length}] ⏭️  ${school.name}: Already geocoded`);
        updatedSchools.push(school);
        skipCount++;
        continue;
      }

      // Geocode the address
      const geocodeResult = await geocodeAddress(address);

      if (geocodeResult) {
        updatedSchools.push({
          ...school,
          address: geocodeResult.address,
          coordinates: geocodeResult.coordinates,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[${i + 1}/${schools.length}] ✓ ${school.name}: ${geocodeResult.displayName}`);
        console.log(`   Coordinates: [${geocodeResult.coordinates[0]}, ${geocodeResult.coordinates[1]}]`);
        successCount++;
      } else {
        updatedSchools.push({
          ...school,
          address: address,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[${i + 1}/${schools.length}] ✗ ${school.name}: Geocoding failed`);
        failCount++;
      }

      // Rate limiting: wait 1 second between requests (Nominatim requirement)
      if (i < schools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(''); // Empty line for readability
    }

    // Write updated schools back to file
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));

    console.log('\n=== Summary ===');
    console.log(`Total schools: ${schools.length}`);
    console.log(`✓ Successfully geocoded: ${successCount}`);
    console.log(`⏭️  Skipped (already geocoded or no address): ${skipCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`\nUpdated schools file: ${SCHOOLS_FILE}`);

  } catch (error) {
    console.error('Error geocoding schools:', error);
    process.exit(1);
  }
}

// Run the script
geocodeAllSchools();

