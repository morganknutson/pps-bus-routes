import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://pps-bus-maps.vercel.app'; // Replace with actual production URL
const SCHOOLS_DATA_PATH = path.join(__dirname, '../data/schools.json');
const SITEMAP_PATH = path.join(__dirname, '../frontend/public/sitemap.xml');

async function generateSitemap() {
  try {
    console.log('Generating sitemap...');

    // Load schools
    if (!fs.existsSync(SCHOOLS_DATA_PATH)) {
      console.error('Schools data file not found!');
      return;
    }

    const schools = JSON.parse(fs.readFileSync(SCHOOLS_DATA_PATH, 'utf8'));
    const lastMod = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/schools</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/neighborhood-directory</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/explore</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/neighborhoods</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${BASE_URL}/tech</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- School Pages (Dynamic) -->
`;

    for (const school of schools) {
      if (school.id) {
        xml += `  <url>
    <loc>${BASE_URL}/${school.id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      }
    }

    xml += `</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, xml);
    console.log(`Sitemap generated successfully at ${SITEMAP_PATH}`);
    console.log(`Total URLs: ${schools.length + 6}`);

  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

generateSitemap();

