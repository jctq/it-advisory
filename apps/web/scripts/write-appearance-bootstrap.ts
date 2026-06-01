import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTeqmdAppearanceBootstrapScript } from '../src/lib/brand/teqmd-appearance-bootstrap-script';

const outputDir = join(process.cwd(), 'public', 'scripts');
const outputPath = join(outputDir, 'teqmd-appearance-bootstrap.js');

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, buildTeqmdAppearanceBootstrapScript(), 'utf8');
console.log(`Wrote ${outputPath}`);
