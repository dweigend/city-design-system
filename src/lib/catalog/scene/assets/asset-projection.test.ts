import { expect, test } from 'bun:test';
import { Color, Mesh, SphereGeometry, Vector3 } from 'three/webgpu';
import { assetRegistry, buildAsset } from '../../logic/assets';
import { loadStructureModules } from '../sandbox/fixtures/structure-modules';

import { scenePalette } from '../scene-palette';
import { tokenColor } from '../material';
import { firedBodyColor } from '../printed-finish';

test('both pastel glaze tokens reach the finish shader with their own pigment', () => {
	const swatches: Record<string, string> = {
		'--body-living': '#acb1ef',
		'--cat-health-3': '#91bfde'
	};
	const palette = scenePalette((names) =>
		Object.fromEntries(names.map((n) => [n, swatches[n] ?? '#ffffff']))
	);
	for (const token of ['--body-living', '--cat-health-3'] as const)
		expect(tokenColor(palette, token).equals(new Color(swatches[token]))).toBe(true);
});

test('the fired body below a white dip separates from both light and dark sheet paper', () => {
	for (const [paper, ink] of [
		['#faf9f5', '#151619'],
		['#17191c', '#ebece7']
	]) {
		const palette = scenePalette((names) =>
			Object.fromEntries(names.map((n) => [n, n === '--paper' ? paper : ink]))
		);
		const clay = firedBodyColor(palette, '--paper').getHex();
		expect(Math.abs((clay & 255) - (new Color(paper).getHex() & 255))).toBeGreaterThan(16);
	}
});

test('glazed profiles form closed oriented shells, including the lip, well and foot', () => {
	for (const entry of assetRegistry.filter((a) => a.category === 'ceramics')) {
		for (const variant of entry.variants) {
			for (const part of buildAsset(entry.id, variant, 17)) {
				if (part.kind !== 'mesh') continue;
				checkClosedShell(part);
			}
		}
	}
});

function checkClosedShell(part: Extract<ReturnType<typeof buildAsset>[number], { kind: 'mesh' }>) {
	const edges = new Map<string, number>();
	let volume = 0;
	for (let i = 0; i < part.triangles.length; i += 3) {
		const [a, b, c] = part.triangles.slice(i, i + 3);
		for (const [from, to] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const key = from + '/' + to;
			edges.set(key, (edges.get(key) ?? 0) + 1);
		}
		const [p, q, r] = [a, b, c].map((j) => new Vector3(...part.points[j]));
		volume += p.dot(q.cross(r)) / 6;
	}
	expect(volume).toBeGreaterThan(0);
	const closed = [...edges].every(
		([edge, count]) => count === 1 && edges.get(edge.split('/').reverse().join('/')) === 1
	);
	expect(closed).toBe(true);
}

test('paper-backed ceramic glaze has a continuous contour and frame bars have solid faces', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const finishes = structureMaterials();
	const dot = new SphereGeometry();
	try {
		for (const id of ['square-flask', 'fluted-tile', 'space-truss', 'lattice-mast', 'derrick']) {
			const parts = buildAsset(id, 'standard', 17);
			const frame = parts.find((p) => p.kind === 'frame');
			const group = populateStructures(frame ? [frame] : parts, finishes, dot);
			const hits: Mesh[] = group.userData.hits;
			expect(hits.length).toBeGreaterThan(0);
			for (const hit of hits) {
				const positions = hit.geometry.getAttribute('position');
				expect(positions.count).toBeGreaterThan(0);
				if (!frame)
					expect(
						group.children.some(
							(o) =>
								o instanceof Mesh &&
								o.geometry.hasAttribute('outlineOffset') &&
								o.geometry.getAttribute('position') === positions
						)
					).toBe(true);
			}
			group.traverse((o) => {
				if (o instanceof Mesh) o.geometry.dispose();
			});
		}
	} finally {
		dot.dispose();
		finishes.dispose();
	}
});
