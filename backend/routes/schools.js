import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchSchool, getSchoolTypes } from '../services/placesService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Helper function to get route count for a school
// Counts unique routes (morning and afternoon versions of the same route count as 1)
function getRouteCount(schoolId) {
  try {
    const schoolRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    if (!fs.existsSync(schoolRoutesDir)) {
      return 0;
    }
    const files = fs.readdirSync(schoolRoutesDir).filter(f => f.endsWith('.json'));
    
    // Track unique route names (morning and afternoon versions count as 1 route)
    const uniqueRouteNames = new Set();
    
    for (const filename of files) {
      try {
        const filePath = path.join(schoolRoutesDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const route = JSON.parse(content);
        
        // Extract route name, handling both new and old formats
        let routeName = route.name;
        let direction = route.direction;
        
        // Migrate old format routes (name with (AM)/(PM) -> separate direction)
        const amMatch = routeName && routeName.match(/^(\d+)\s*\(AM\)$/);
        const pmMatch = routeName && routeName.match(/^(\d+)\s*\(PM\)$/);
        
        if (amMatch && !direction) {
          routeName = amMatch[1]; // Just the number
          direction = 'Morning';
        } else if (pmMatch && !direction) {
          routeName = pmMatch[1]; // Just the number
          direction = 'Afternoon';
        }
        
        // Use route name as the unique identifier (ignoring direction)
        if (routeName) {
          uniqueRouteNames.add(routeName);
        }
      } catch (error) {
        console.error(`Error reading route file ${filename} for school ${schoolId}:`, error);
        // Continue processing other files even if one fails
      }
    }
    
    return uniqueRouteNames.size;
  } catch (error) {
    console.error(`Error counting routes for school ${schoolId}:`, error);
    return 0;
  }
}

/**
 * Get all schools
 */
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      // Create default schools file if it doesn't exist
      const defaultSchools = [
        {
          id: 'west-sylvan',
          name: 'West Sylvan',
          schoolPageLink: null,
          driveLink: null,
          createdAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(defaultSchools, null, 2));
      // Add route counts to default schools
      const schoolsWithCounts = defaultSchools.map(school => ({
        ...school,
        routeCount: getRouteCount(school.id),
      }));
      return res.json({ schools: schoolsWithCounts });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    // Ensure schools is an array
    if (!Array.isArray(schools)) {
      console.error('Schools file does not contain an array:', typeof schools);
      return res.status(500).json({ error: 'Invalid schools data format' });
    }
    
    // Add route counts to each school
    const schoolsWithCounts = schools.map(school => ({
      ...school,
      routeCount: getRouteCount(school.id),
    }));
    
    res.json({ schools: schoolsWithCounts });
  } catch (error) {
    console.error('Error loading schools:', error);
    console.error('Error stack:', error.stack);
    console.error('Schools file path:', SCHOOLS_FILE);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

/**
 * Get a specific school
 */
router.get('/:schoolId', (req, res) => {
  try {
    const { schoolId } = req.params;
    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const school = schools.find((s) => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Add route count to the school
    const schoolWithCount = {
      ...school,
      routeCount: getRouteCount(schoolId),
    };

    res.json({ school: schoolWithCount });
  } catch (error) {
    console.error('Error loading school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new school
 */
router.post('/', (req, res) => {
  try {
    const { name, schoolPageLink, driveLink } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'School name is required' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    // Generate ID from name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if school already exists
    if (schools.find((s) => s.id === id)) {
      return res.status(400).json({ error: 'School with this name already exists' });
    }

    const newSchool = {
      id,
      name,
      schoolPageLink: schoolPageLink || null,
      driveLink: driveLink || null,
      createdAt: new Date().toISOString(),
    };

    schools.push(newSchool);
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    // Create school directory for processed routes
    const schoolDir = path.join(DATA_DIR, 'schools', id, 'processed-routes');
    if (!fs.existsSync(schoolDir)) {
      fs.mkdirSync(schoolDir, { recursive: true });
    }

    res.json({ school: newSchool });
  } catch (error) {
    console.error('Error creating school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a school (including school page link and drive link)
 */
router.put('/:schoolId', (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, schoolPageLink, driveLink, address, coordinates } = req.body;

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const schoolIndex = schools.findIndex((s) => s.id === schoolId);

    if (schoolIndex === -1) {
      return res.status(404).json({ error: 'School not found' });
    }

    const updatedSchool = {
      ...schools[schoolIndex],
      ...(name && { name }),
      ...(schoolPageLink !== undefined && { schoolPageLink }),
      ...(driveLink !== undefined && { driveLink }),
      ...(address !== undefined && { address }),
      ...(coordinates !== undefined && { coordinates }),
      updatedAt: new Date().toISOString(),
    };

    schools[schoolIndex] = updatedSchool;
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    res.json({ school: updatedSchool });
  } catch (error) {
    console.error('Error updating school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a school's address using Google Places API
 */
router.post('/:schoolId/update-address', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const schoolIndex = schools.findIndex((s) => s.id === schoolId);

    if (schoolIndex === -1) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = schools[schoolIndex];
    
    // Search for the school using Places API
    console.log(`[Places API] Searching for: ${school.name}`);
    const searchResult = await searchSchool(school.name);

    if (!searchResult.success) {
      return res.status(400).json({ 
        error: 'Failed to find school address',
        details: searchResult.error 
      });
    }

    const place = searchResult.place;
    
    // Get school types for this school
    const schoolTypes = getSchoolTypes(school.name);
    
    // Update school with new address, coordinates, and school types
    const updatedSchool = {
      ...school,
      address: place.address,
      coordinates: place.coordinates,
      schoolTypes: schoolTypes,
      updatedAt: new Date().toISOString(),
    };

    schools[schoolIndex] = updatedSchool;
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    console.log(`[Places API] Updated ${school.name}: ${place.address}`);

    res.json({ 
      school: updatedSchool,
      place: {
        name: place.name,
        address: place.address,
        coordinates: place.coordinates
      }
    });
  } catch (error) {
    console.error('Error updating school address:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Batch update addresses for all schools
 */
router.post('/batch-update-addresses', async (req, res) => {
  try {
    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    const results = [];
    const updatedSchools = [...schools];

    console.log(`[Places API] Starting batch update for ${schools.length} schools`);

    // Process each school with rate limiting (1 request per second)
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      
      try {
        console.log(`[${i + 1}/${schools.length}] Processing: ${school.name}`);
        
        const searchResult = await searchSchool(school.name);

        if (searchResult.success && searchResult.place) {
          const place = searchResult.place;
          const schoolIndex = updatedSchools.findIndex((s) => s.id === school.id);
          
          if (schoolIndex !== -1) {
            // Get school types for this school
            const schoolTypes = getSchoolTypes(school.name);
            
            updatedSchools[schoolIndex] = {
              ...updatedSchools[schoolIndex],
              address: place.address,
              coordinates: place.coordinates,
              schoolTypes: schoolTypes,
              updatedAt: new Date().toISOString(),
            };
          }

          results.push({
            schoolId: school.id,
            schoolName: school.name,
            success: true,
            address: place.address,
            coordinates: place.coordinates
          });

          console.log(`  ✅ Updated: ${place.address}`);
        } else {
          results.push({
            schoolId: school.id,
            schoolName: school.name,
            success: false,
            error: searchResult.error || 'Failed to find school'
          });

          console.log(`  ❌ Failed: ${searchResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          success: false,
          error: error.message
        });

        console.log(`  ❌ Error: ${error.message}`);
      }

      // Rate limiting: wait 1 second between requests (except for the last one)
      if (i < schools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save updated schools
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Places API] Batch update complete: ${successCount} succeeded, ${failureCount} failed`);

    res.json({
      total: schools.length,
      succeeded: successCount,
      failed: failureCount,
      results
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a school
 */
router.delete('/:schoolId', (req, res) => {
  try {
    const { schoolId } = req.params;

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const filteredSchools = schools.filter((s) => s.id !== schoolId);

    if (schools.length === filteredSchools.length) {
      return res.status(404).json({ error: 'School not found' });
    }

    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(filteredSchools, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting school:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as schoolsRouter };

