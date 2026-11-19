import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
	BackSide,
	Color,
	Mesh,
	MeshBasicNodeMaterial,
	Object3D,
	SphereGeometry
} from 'three/webgpu';
import type { Group } from 'three/webgpu';
import { scenePalette } from './scene-palette';
import { sandboxStyle } from './sandbox/drafting-style';
import { frameClock } from './sandbox/fixtures/frame-clock';
import { forms } from '../logic/material/sample-forms';
import { glazeContourMaterial } from './sandbox/structure-outline';

// The CPU renderer and DOM shims belong to this process only.
if (process.env.GLAZE_CONTOUR_TEST === '1') await exerciseGlazeContour();
else
	test('Bible and sandbox glaze use the same ink contour and pixel width', () => {
		const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
			encoding: 'utf8',
			timeout: 4000,
			env: { ...process.env, GLAZE_CONTOUR_TEST: '1' }
		});
		assert.equal(run.status, 0, run.stderr || String(run.error));
	});

function contourOf(drawing: Object3D) {
	let contour: MeshBasicNodeMaterial | undefined;
	drawing.traverse((object) => {
		if (object instanceof Mesh && object.geometry.hasAttribute('outlineOffset')) {
			assert(object.material instanceof MeshBasicNodeMaterial);
			contour = object.material;
		}
	});
	assert(contour);
	return contour;
}

async function exerciseGlazeContour() {
	const clock = frameClock();
	const [{ createParametrikScene }, { structureMaterials }, { populateStructures }, { grammatik }] =
		await Promise.all([
			import('./parametrik'),
			import('./sandbox/structure-materials'),
			import('./sandbox/structure-parts'),
			import('./leitstil')
		]);
	const palette = scenePalette((names) =>
		Object.fromEntries(names.map((name) => [name, '#808080']))
	);
	const canvas = clock.canvas();
	const stage = createParametrikScene(canvas, palette, assert.fail, false);
	const finishes = structureMaterials();
	const bearing = new SphereGeometry();
	const part = { ...forms.sphere, finish: 'keramik-glasiert' as const };
	const style = sandboxStyle({ zoom: 'nah', modus: 'ansehen', situation: 'normal' });
	const tones = grammatik(canvas, style);
	finishes.setStyle(style, 'all', 48, tones);
	const group = populateStructures([part], finishes, bearing);
	try {
		await stage.ready;
		stage.update([part]);
		const bible = contourOf(clock.draw());
		const sandbox = contourOf(group);
		assert(finishes.contours);
		assert.equal(sandbox, glazeContourMaterial(finishes.contours.glaze));
		assert(bible.vertexNode);
		assert.equal(bible.vertexNode, sandbox.vertexNode);
		assert.equal(bible.side, BackSide);
		assert.equal(sandbox.side, BackSide);
		assert(bible.color.equals(new Color(palette.ink)));
		assert(sandbox.color.equals(tones.ink));
		const ink = new Color('#eae8e1');
		finishes.setStyle(style, 'all', 48, { ...tones, ink });
		assert.equal(contourOf(group), sandbox);
		assert(sandbox.color.equals(ink));
		await exerciseSnapshot(stage, canvas, group);
	} finally {
		stage.dispose();
		finishes.dispose();
		bearing.dispose();
		group.traverse((object) => {
			if (object instanceof Mesh) object.geometry.dispose();
		});
	}
}

async function exerciseSnapshot(
	stage: Pick<ReturnType<typeof import('./parametrik').createParametrikScene>, 'snapshotDrawing'>,
	canvas: HTMLCanvasElement,
	drawing: Group
) {
	let encode: BlobCallback = () => assert.fail('The stage did not request a PNG.');
	canvas.toBlob = (callback) => {
		encode = callback;
		assert(drawing.parent);
	};
	const failed = stage.snapshotDrawing(drawing, [1, -1, 1]);
	encode(null);
	await assert.rejects(failed, /could not encode/);
	assert.equal(drawing.parent, null);

	const capture = stage.snapshotDrawing(drawing, [1, -1, 1]);
	const png = new Blob(['image'], { type: 'image/png' });
	encode(png);
	assert.equal(await capture, png);
	assert.equal(drawing.parent, null);
}
