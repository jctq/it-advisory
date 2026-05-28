import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTechmdAppearanceBootstrapScript } from '../src/lib/brand/techmd-appearance-bootstrap-script';

const outputDir = join(process.cwd(), 'public', 'scripts');
const outputPath = join(outputDir, 'techmd-appearance-bootstrap.js');

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, buildTechmdAppearanceBootstrapScript(), 'utf8');
console.log(`Wrote ${outputPath}`);
