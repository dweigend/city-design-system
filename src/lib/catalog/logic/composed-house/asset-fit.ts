import { assetRegistry, type Attachment, type SlotAssignment } from '../assets';
import { bounds, union } from '../ansicht/geometrie';
import { required } from '../required';
import { houseObject, type HousePart } from './house-object';
import type { Vec3 } from '../parametrik/types';
import { hashUnit } from '../../core/random';

type Mount = { position: Vec3; size: Vec3; angle?: number };
type Fit = { point: (p: Vec3) => Vec3; scale: Vec3; angle: number };

/** Builds an addressed variant and locates its mounting plane in local metres. */
export function fitting(
	id: string,
	instance: string,
	seed: number,
	attachment: Attachment,
	assignments: Readonly<Record<string, SlotAssignment>>,
	selected?: string
) {
	const asset = required(
		assetRegistry.find((a) => a.id === id),
		id
	);

	const variant =
		selected ??
		asset.variants[Math.floor(hashUnit(seed, instance, 'variant') * asset.variants.length)];
	const slots = Object.fromEntries(
		asset.slotNames.map((name) => [name, required(assignments[name], id + '/' + name)])
	);
	const object = houseObject(id, variant, seed, { instanceId: instance + '/' + id, slots });
	const anchor = required(
		object.anchors.find((a) => a.attachment === attachment),
		id + ' ' + attachment
	);
	return { parts: object.parts, anchor, footprint: object.footprint };
}
function placed(part: HousePart, { point, scale: [sx, sy, sz], angle }: Fit): HousePart {
	const radius = Math.min(sx, sy);
	switch (part.kind) {
		case 'pipe':
			return {
				...part,
				points: part.points.map(point),
				radius: part.radius * Math.min(radius, sz)
			};
		case 'capsule':
			return { ...part, from: point(part.from), to: point(part.to), radius: part.radius * radius };
		case 'sphere':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				squash: ((part.squash ?? 1) * sz) / radius
			};
		case 'dome':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				height: (part.height ?? part.radius) * sz
			};
		case 'cylinder':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				height: part.height * sz
			};
		case 'frame': {
			const [w, d, h] = part.size;
			return {
				...part,
				position: point(part.position),
				size: [w * sx, d * sy, h * sz],
				bar: part.bar * radius
			};
		}
		case 'box':
		case 'wedge': {
			const [w, d, h] = part.size,
				[x, y, z] = part.position;
			const center = point([x + w / 2, y + d / 2, z]);
			return {
				...part,
				position: [center[0] - (w * sx) / 2, center[1] - (d * sy) / 2, center[2]],
				size: [w * sx, d * sy, h * sz],
				rotation: (part.rotation ?? 0) + angle
			};
		}
		default:
			throw new RangeError('Unsupported house fitting ' + part.kind);
	}
}

/** Fits an anchored kit to its reserved space. A stair's height is measured at its top tread. */
export function mountFitting(asset: ReturnType<typeof fitting>, mount: Mount, flight = false) {
	const { parts, anchor, footprint } = asset;
	const box = union(parts.map(bounds));
	const [w, d, h] = mount.size;
	const height = flight
		? Math.max(...parts.filter((p) => p.kind === 'box').map((p) => bounds(p).max[2]))
		: box.max[2];
	const rigid = parts.some((p) => p.kind === 'capsule');
	// A rigid unit keeps its proportions: it fits its own extent and never grows beyond 15 %.
	const planScale = rigid
		? Math.min(w / (box.max[0] - box.min[0]), d / (box.max[1] - box.min[1]), h / height, 1.15)
		: Math.min(w / footprint[0], d / footprint[1]);
	const rectangular = parts.every(
		(p) => p.kind === 'box' || p.kind === 'pipe' || p.kind === 'wedge'
	);
	const scale: Vec3 = rectangular
		? [w / (box.max[0] - box.min[0]), d / (box.max[1] - box.min[1]), h / height]
		: [planScale, planScale, rigid ? planScale : h / height];
	const angle = mount.angle ?? 0,
		c = Math.cos(angle),
		s = Math.sin(angle);
	const point = ([x, y, z]: Vec3): Vec3 => {
		const dx = (x - anchor.position[0]) * scale[0],
			dy = (y - anchor.position[1]) * scale[1];
		return [
			mount.position[0] + dx * c - dy * s,
			mount.position[1] + dx * s + dy * c,
			mount.position[2] + (z - anchor.position[2]) * scale[2]
		];
	};
	return parts.map((p) => placed(p, { point, scale, angle }));
}
