import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

const sizes = [16, 32, 48, 128];
const colors = ['green', 'red', 'grey'];

async function generateIcons() {
  for (const color of colors) {
    const svgPath = path.join('icons', `shield-${color}.svg`);
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    for (const size of sizes) {
      const resvg = new Resvg(svgContent, {
        fitTo: {
          mode: 'width',
          value: size
        }
      });
      
      const pngData = resvg.render();
      const pngPath = path.join('public', `icon-${color}-${size}.png`);
      
      fs.writeFileSync(pngPath, pngData.asPng());
      console.log(`Generated: ${pngPath}`);
    }
  }
}

generateIcons().catch(console.error);