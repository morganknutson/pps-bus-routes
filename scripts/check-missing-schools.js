import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupportedSchoolCodes } from '../backend/utils/schoolUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load schools.json
const schoolsFile = path.join(__dirname, '..', 'data', 'schools.json');
const schools = JSON.parse(fs.readFileSync(schoolsFile, 'utf8'));

// Get all supported codes
const supportedCodes = getSupportedSchoolCodes();

// Create reverse mapping: school ID -> code
const codeToIdMap = {
  'ABE': 'abernethy', 'AIN': 'ainsworth', 'ALA': 'alameda', 'ARL': 'arleta',
  'AST': 'astor', 'ATK': 'atkinson', 'BCH': 'beach', 'BDG': 'bridger',
  'BDL': 'bridlemile', 'BEL': 'boise-eliot', 'BMT': 'beaumont', 'BUC': 'buckman',
  'CAP': 'capitol', 'CCH': 'cesar-chavez', 'CHJ': 'chief-joseph', 'CHP': 'chapman',
  'CLK': 'clark', 'CRE': 'creston', 'DUN': 'duniway', 'FAU': 'faubion',
  'FPK': 'forest-park', 'GLE': 'glencoe', 'GRG': 'george', 'GRT': 'grout',
  'GRY': 'gray', 'HAY': 'hayhurst', 'HOS': 'hosford', 'HPK': 'harrison-park',
  'IRV': 'irvington', 'JKS': 'jackson', 'JMJ': 'james-john', 'KLG': 'kellogg',
  'KLY': 'kelly', 'LAN': 'lane', 'LEE': 'lee', 'LEW': 'lewis', 'LLE': 'llewellyn',
  'LNC': 'lincoln', 'LNT': 'lent', 'MKM': 'markham', 'MLK': 'dr-martin-luther-king',
  'MPL': 'maplewood', 'MRY': 'marysville', 'SYL': 'west-sylvan',
};

const idToCodeMap = {};
for (const [code, id] of Object.entries(codeToIdMap)) {
  idToCodeMap[id] = code;
}

// Find schools without codes
const schoolsWithoutCodes = schools.filter(school => !idToCodeMap[school.id]);

console.log('Schools in schools.json without code mappings:');
console.log('================================================\n');

if (schoolsWithoutCodes.length > 0) {
  schoolsWithoutCodes.forEach(school => {
    console.log(`   ${school.id} (${school.name})`);
  });
  console.log(`\n   Total: ${schoolsWithoutCodes.length}`);
} else {
  console.log('✅ All schools have code mappings!');
}

console.log(`\n📊 Summary:`);
console.log(`   Total schools in schools.json: ${schools.length}`);
console.log(`   Schools with codes: ${schools.length - schoolsWithoutCodes.length}`);
console.log(`   Schools without codes: ${schoolsWithoutCodes.length}`);













