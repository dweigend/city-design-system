import { buildConstructionPhases, type ConstructionPhases } from '../../logic/style-house';
import type { Vec3 } from '../../logic/parametrik/types';
import { createParametrikScene, type View } from '../parametrik';
import { readPalette } from '../themeBinding';
import type { ChapterStageFactory } from './types';

/** World direction toward the camera: the houses show their front and their right side. */
const EYE: Vec3 = [0.8, -1, 0.62];
const EYE_LENGTH = Math.hypot(...EYE);
const EYE_COSINE = Math.hypot(EYE[0], EYE[1]) / EYE_LENGTH;
const EYE_SINE = EYE[2] / EYE_LENGTH;
/** Unit vectors in plan: left to right on screen, and from the scene toward the camera. */
const ACROSS = [-EYE[1] / (EYE_LENGTH * EYE_COSINE), EYE[0] / (EYE_LENGTH * EYE_COSINE)] as const;
const TOWARD = [EYE[0] / (EYE_LENGTH * EYE_COSINE), EYE[1] / (EYE_LENGTH * EYE_COSINE)] as const;
/**
 * The lots follow one alley along world x. Seen from the front right the row steps toward the
 * reader, so it fills a narrow stage as well as a wide one.
 */
const ROW_AXIS = [1, 0] as const;
/** Depth of a lot toward the camera that the frame keeps, as a share of the lot width. */
const LOT_REACH = 0.55;
/** Half width of one house across the view, as a share of the lot width. */
const LOT_HALF_WIDTH = 0.66;

/**
 * Frames the house under construction, or the whole row when all three stand.
 * Width and height are the viewport in CSS pixels.
 */
function phaseView({ inputs, lots, active }: ConstructionPhases, width: number, height: number) {
	const shown = active === undefined ? lots : [lots[active]];
	const [x, y] = active === undefined ? [0, 0] : lots[active].centre;
	const offsets = shown.map(({ centre }) => [centre[0] - x, centre[1] - y]);
	const across = Math.max(...offsets.map(([dx, dy]) => Math.abs(dx * ACROSS[0] + dy * ACROSS[1])));
	const depth = Math.max(...offsets.map(([dx, dy]) => Math.abs(dx * TOWARD[0] + dy * TOWARD[1])));
	const halfHeight =
		1.04 * ((inputs.height / 2) * EYE_COSINE + (LOT_REACH * inputs.width + depth) * EYE_SINE);
	const halfWidth = across + LOT_HALF_WIDTH * inputs.width;
	return {
		center: [x, y, inputs.height / 2 - inputs.width * 0.06],
		eye: EYE,
		span: Math.max(halfHeight, (halfWidth * height) / width)
	} satisfies View;
}

/**
 * Shows the three construction-phase houses on neighbouring lots of the shared drawing scene.
 * The still shows the finished row. `reveal(phase)` builds phase by phase: the new house in its
 * surfaces, every earlier one as plain stock, the camera on the lot under construction.
 * Dragging turns the row; the stage owns its scene and releases it on dispose.
 */
export const createStyleHouseChapterStage: ChapterStageFactory = (canvas, onError) => {
	const scene = createParametrikScene(canvas, readPalette(canvas), onError, 'turn');
	let phases = buildConstructionPhases(ROW_AXIS);
	let size: [number, number] = [1, 1];
	let ready = false;
	let alive = true;
	let settling = 0;

	// The studio depth and contact passes refresh once per animation frame, so a camera set in
	// the frame that changed the scene is drawn again in the next one.
	function frame() {
		scene.frame(phaseView(phases, ...size));
		cancelAnimationFrame(settling);
		settling = requestAnimationFrame(() => {
			if (alive) scene.frame(phaseView(phases, ...size));
		});
	}
	// A new phase directs the camera again, also after the reader has turned the row.
	function draw() {
		if (!ready || !alive) return;
		scene.update(phases.parts);
		scene.reset();
		frame();
	}
	void scene.ready
		.then(() => {
			ready = true;
			scene.resize(...size);
			draw();
		})
		.catch(() => {});

	return {
		show() {
			phases = buildConstructionPhases(ROW_AXIS);
			draw();
		},
		reveal(phase) {
			const next = buildConstructionPhases(ROW_AXIS, phase);
			if (next.active === undefined && phases.active === undefined) return;
			phases = next;
			draw();
		},
		setView() {
			if (ready && alive) frame();
		},
		resize(width, height) {
			size = [width, height];
			if (!ready || !alive) return;
			scene.resize(width, height);
			frame();
		},
		dispose() {
			alive = false;
			cancelAnimationFrame(settling);
			void scene.dispose();
		}
	};
};
