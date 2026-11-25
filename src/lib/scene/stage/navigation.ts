import { defaults } from '../../../config/stage';
import { anchoredPan, groundAt, type CameraFrame, type ViewFit } from './camera';

type Point = Readonly<{ x: number; y: number }>;

/** Positive, finite relative zoom bounds, inclusive. */
export type ZoomLimits = Readonly<{ minZoom?: number; maxZoom?: number }>;

/** Pointer and keyboard navigation. With `readFrame`, a zoom keeps the ground point under the
 * cursor exactly, even when the camera tilts with the frame width. Limits default to 0.55 and 32. */
export function stageNavigation(
	canvas: HTMLCanvasElement,
	readScale: () => number,
	fit: (value: ViewFit) => void,
	readFrame?: (value: Readonly<{ zoom: number; offset: readonly [number, number] }>) => CameraFrame,
	canDrag?: () => boolean,
	{ minZoom = defaults.navigationMinZoom, maxZoom = defaults.navigationMaxZoom }: ZoomLimits = {}
) {
	if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || minZoom <= 0 || maxZoom < minZoom)
		throw new RangeError('Expected finite, positive and ordered zoom limits');
	const clampZoom = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom));
	const initialZoom = clampZoom(1);
	const pointers = new Map<number, Point>();
	let zoom = initialZoom;
	let offset: [number, number] = [0, 0];
	let metersPerPixel = 1;
	let previousScale = 1;

	function move(from: Point, to: Point, ratio: number) {
		const measured = readScale();
		if (measured !== previousScale) metersPerPixel = measured;
		previousScale = measured;
		const next = clampZoom(zoom * ratio);
		const scale = (metersPerPixel * zoom) / next;
		const rect = canvas.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		if (readFrame) {
			const current = readFrame({ zoom, offset });
			const destination = readFrame({ zoom: next, offset });
			const anchor = groundAt(current, [from.x - x, from.y - y], destination);
			const [dx, dy] = anchoredPan(destination, anchor, [to.x - x, to.y - y]);
			offset = [offset[0] + dx, offset[1] + dy];
			metersPerPixel = scale;
			zoom = next;
			fit({ offset, zoom });
			return;
		}
		offset = [
			offset[0] + (from.x - x) * metersPerPixel - (to.x - x) * scale,
			offset[1] - (from.y - y) * metersPerPixel + (to.y - y) * scale
		];
		metersPerPixel = scale;
		zoom = next;
		fit({ offset, zoom });
	}

	function gesture() {
		const [a, b] = pointers.values();
		if (!b) return { point: a, distance: 1 };
		return {
			point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
			distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
		};
	}

	function point(event: MouseEvent): Point {
		return { x: event.clientX, y: event.clientY };
	}

	function reset() {
		zoom = initialZoom;
		offset = [0, 0];
		previousScale = NaN;
		fit(initialZoom === 1 ? {} : { zoom: initialZoom });
	}

	const listeners = new AbortController();
	const { signal } = listeners;
	canvas.addEventListener(
		'wheel',
		(event) => {
			event.preventDefault();
			const delta =
				event.deltaY *
				(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
			move(point(event), point(event), Math.exp(-delta * 0.0017));
		},
		{ signal, passive: false }
	);
	canvas.addEventListener(
		'pointerdown',
		(event) => {
			if (event.button !== 0 || pointers.size >= 2 || canDrag?.() === false) return;
			canvas.setPointerCapture(event.pointerId);
			pointers.set(event.pointerId, point(event));
		},
		{ signal }
	);
	canvas.addEventListener(
		'pointermove',
		(event) => {
			if (!pointers.has(event.pointerId)) return;
			const before = gesture();
			pointers.set(event.pointerId, point(event));
			const after = gesture();
			move(before.point, after.point, after.distance / before.distance);
		},
		{ signal }
	);
	for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
		canvas.addEventListener(type, (event) => pointers.delete((event as PointerEvent).pointerId), {
			signal
		});

	canvas.addEventListener(
		'keydown',
		(event) => {
			const rect = canvas.getBoundingClientRect();
			const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
			const dx = 40 * (Number(event.key === 'ArrowLeft') - Number(event.key === 'ArrowRight'));
			const dy = 40 * (Number(event.key === 'ArrowUp') - Number(event.key === 'ArrowDown'));
			const ratio = event.key === '+' || event.key === '=' ? 1.25 : event.key === '-' ? 0.8 : 1;
			if (event.key === 'Home') reset();
			else if (dx || dy || ratio !== 1) move(center, { x: center.x + dx, y: center.y + dy }, ratio);
			else return;
			event.preventDefault();
		},
		{ signal }
	);

	try {
		if (initialZoom !== 1) reset();
	} catch (error) {
		listeners.abort();
		throw error;
	}

	return {
		reset,
		delete: () => listeners.abort()
	};
}
