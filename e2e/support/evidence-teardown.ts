import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeManifest } from './evidence';

/** Global teardown: merges the evidence entries into manifest.json when a capture ran. */
export default function evidenceTeardown() {
	const dir = process.env.EVIDENCE_DIR;
	if (!dir || !existsSync(join(dir, '.entries'))) return;
	const count = writeManifest(dir);
	console.log(`evidence: ${count} screenshots, manifest ${join(dir, 'manifest.json')}`);
}
