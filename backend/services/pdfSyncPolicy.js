import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

/** Compare Drive revisions with durable metadata and bytes, never checkout mtimes. */
export class PdfSyncPolicy {
  static needsDownload(file, metadata, pdfPath) {
    if (!fs.existsSync(pdfPath)) return true;
    if (file.md5Checksum) {
      const checksum = createHash('md5').update(fs.readFileSync(pdfPath)).digest('hex');
      if (checksum !== file.md5Checksum) return true;
    }
    if (!metadata || metadata.filename !== file.name) return true;
    if (!file.modifiedTime) return !file.md5Checksum;
    return file.modifiedTime !== metadata.modifiedTime;
  }

  static needsProcessing(jsonPath) {
    try {
      const route = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return !route.stops?.some(stop => !stop.isSchoolStop && !stop.skipGeocoding);
    } catch {
      return true;
    }
  }

  static needsSync(file, metadata, schoolDir) {
    return this.needsDownload(file, metadata, path.join(schoolDir, 'pdfs', file.name))
      || this.needsProcessing(path.join(schoolDir, 'processed-routes', file.name.replace(/\.pdf$/i, '.json')));
  }

  static orphanedRoutes(files, schoolDir) {
    const dir = path.join(schoolDir, 'processed-routes');
    if (!fs.existsSync(dir)) return [];
    const expected = new Set(files.map(file => file.name.replace(/\.pdf$/i, '.json')));
    return fs.readdirSync(dir).filter(name => name.endsWith('.json') && !expected.has(name));
  }
}
