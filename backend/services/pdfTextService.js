import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const execFileAsync = promisify(execFile);

/** Extract text locally; scanned documents require Poppler and Tesseract. */
export class PdfTextService {
  async extract(buffer) {
    try {
      const result = await pdfParse(buffer, { version: 'v2.0.550' });
      if (result.text.trim()) return result.text;
    } catch {
      // Poppler can also recover PDFs rejected by the older bundled PDF.js.
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppsbus-pdf-'));
    try {
      const pdfPath = path.join(dir, 'source.pdf');
      await fs.writeFile(pdfPath, buffer);
      const options = { timeout: 120000, maxBuffer: 10 * 1024 * 1024 };
      const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], options);
      if (stdout.trim()) return stdout;
      await execFileAsync('pdftoppm', ['-r', '200', '-png', pdfPath, path.join(dir, 'page')], options);
      const pages = (await fs.readdir(dir)).filter(file => file.endsWith('.png'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const texts = [];
      for (const page of pages) {
        const result = await execFileAsync('tesseract', [path.join(dir, page), 'stdout', '-l', 'eng', '--psm', '6'], options);
        texts.push(result.stdout);
      }
      return texts.join('\n');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}

export const pdfTextService = new PdfTextService();
