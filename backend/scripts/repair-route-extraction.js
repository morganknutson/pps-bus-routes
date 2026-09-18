/** Audit cached PDFs without API calls; --write repairs mismatches using normal geocoding. */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pdfTextService } from '../services/pdfTextService.js';
import { parseRouteFromPDF } from '../services/pdfParser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/schools');
const write = process.argv.includes('--write');
const processSinglePDF = write ? (await import('../services/routeProcessor.js')).processSinglePDF : null;
const mismatches = [];
const errors = [];
let checked = 0;
let repaired = 0;
for (const school of await fs.readdir(root)) {
  const dir = path.join(root, school, 'processed-routes');
  let files;
  try { files = await fs.readdir(dir); } catch { continue; }
  for (const file of files.filter(name => name.endsWith('.json'))) {
    try {
      const route = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
      const buffer = await fs.readFile(path.join(root, school, 'pdfs', route.filename));
      const text = await pdfTextService.extract(buffer);
      const parsed = parseRouteFromPDF(text, route.id, route.filename);
      const expected = parsed.stops.filter(stop => !stop.skipGeocoding);
      const actual = route.stops.filter(stop => !stop.isSchoolStop);
      const signature = stops => JSON.stringify(stops.map(stop => [stop.address, stop.time?.replace(/\s/g, '').toLowerCase()]));
      checked++;
      if (signature(expected) !== signature(actual) || route.name !== parsed.name || route.direction !== parsed.direction) {
        mismatches.push({ school, file, expected: expected.length, actual: actual.length });
        if (write) {
          await processSinglePDF(buffer, route.filename, route.fileId || route.id, { schoolId: school, saveToFile: true });
          repaired++;
        }
      }
    } catch (error) {
      errors.push({ school, file, error: error.message });
    }
  }
}
console.log(JSON.stringify({ checked, repaired, mismatches, errors }, null, 2));
if (errors.length || (!write && mismatches.length)) process.exitCode = 1;
