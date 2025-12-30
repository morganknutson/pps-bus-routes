import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Please provide a PDF path');
  process.exit(1);
}

const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
  console.log('--- PDF Text ---');
  console.log(data.text);
  console.log('--- End Text ---');
}).catch(err => {
  console.error('Error parsing PDF:', err);
});

