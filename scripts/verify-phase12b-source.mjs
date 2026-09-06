import fs from 'node:fs';
import path from 'node:path';

function check() {
  const imagePath = path.join(process.cwd(), 'src/features/ai/receipt-vision/image.ts');
  const code = fs.readFileSync(imagePath, 'utf8');
  
  if (!code.includes('PHASE_12B_MAX_RECEIPT_FILE_BYTES')) {
    throw new Error('Missing file size check before buffer');
  }
  if (!code.includes('isJpeg') || !code.includes('isPng') || !code.includes('isWebp')) {
    throw new Error('Missing magic bytes check');
  }
  if (!code.includes('limitInputPixels')) {
    throw new Error('Missing limitInputPixels check in Sharp');
  }
  console.log('Phase 12B source verification passed.');
}

check();
