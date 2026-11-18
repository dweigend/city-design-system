import type { CrossSection, Manifold, Vec2, Vec3 } from 'manifold-3d';
import type { Roof, Settings } from './contract';
import { localResolution } from './precision';
import { clip, type Solids } from './solids';

type RoofFrame = { across: Vec2; low: number; width: number; slope: number; eave: number };
function frame(section: CrossSection, p: Settings): RoofFrame {
	const across: Vec2 = [-Math.sin(p.direction), Math.cos(p.direction)];
	const span = section
		.toPolygons()
		.flat()
		.map(([x, y]) => x * across[0] + y * across[1]);
	const low = Math.min(...span);
	return { across, low, width: Math.max(...span) - low, slope: Math.tan(p.pitch), eave: p.height };
}
function below(s: Solids, body: Manifold, f: RoofFrame, slope: number, start: number) {
	return clip(s, body, [slope * f.across[0], slope * f.across[1], -1], slope * start - f.eave);
}
function teeth(s: Solids, section: CrossSection, body: Manifold, f: RoofFrame, count: number) {
	const [x, y] = f.across,
		step = f.width / count;
	const along = section
		.toPolygons()
		.flat()
		.map(([a, b]) => a * y - b * x);
	const near = Math.min(...along) - 1,
		far = Math.max(...along) + 1;
	const peak = f.eave + step * f.slope;
	// Continue the first and last slopes past the footprint. A profile corner exactly
	// at a rounded wall's support point can leave a zero-length edge after clipping.
	const end = f.low + f.width;
	const bottom = -1 - f.slope;
	const profile: Vec2[] = [
		[f.low - 1, bottom],
		[end + 1, bottom],
		[end + 1, peak + f.slope]
	];
	for (let i = count - 1; i > 0; i--) {
		const u = f.low + i * step;
		profile.push([u, f.eave], [u, peak]);
	}
	profile.push([f.low - 1, f.eave - f.slope]);
	const shape = s.keep(new s.kernel.CrossSection(profile));
	const sweep = s.keep(shape.extrude(far - near));
	const cutter = s.keep(
		sweep.transform([x, y, 0, 0, 0, 0, 1, 0, y, -x, 0, 0, near * y, -near * x, 0, 1])
	);
	return s.keep(body.intersect(cutter));
}
function sweptEdge(s: Solids, a: Vec2, b: Vec2, f: RoofFrame, reach: number) {
	const [x, y] = f.across,
		top = f.eave + reach * f.slope;
	const points: Vec3[] = [];
	for (const p of [a, b]) {
		points.push([...p, f.eave]);
		for (const u of [-reach, reach])
			for (const v of [-0.5 * reach, 0.5 * reach])
				points.push([p[0] + u * x - v * y, p[1] + u * y + v * x, top]);
	}
	return s.keep(s.kernel.Manifold.hull(points));
}
function hipped(s: Solids, section: CrossSection, f: RoofFrame) {
	const bounds = section.bounds();
	const reach = 2 * Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1]);
	const body = s.keep(section.extrude(f.eave + reach * f.slope));
	const cutters = section
		.toPolygons()
		.flatMap((r) => r.map((p, i) => sweptEdge(s, p, r[(i + 1) % r.length], f, reach)));
	return s.keep(s.kernel.Manifold.difference([body, ...cutters]));
}
/** Constructs the last storey and roof in one volume, with a horizontal eave datum. */
export function roofSolid(s: Solids, section: CrossSection, roof: Roof, p: Settings, z: number) {
	const f = frame(section, p);
	const bounds = section.bounds();
	const resolution = localResolution(
		Math.max(
			...bounds.min.map(Math.abs),
			...bounds.max.map(Math.abs),
			Math.abs(z),
			Math.abs(z + p.height + f.width * f.slope)
		)
	);
	if (f.width * f.slope <= resolution) return s.keep(section.extrude(p.height));
	if (roof === 'hip') {
		// Construct the wavefront at unit pitch so near-horizontal cutters never become sliver solids.
		const unit = hipped(s, section, { ...f, slope: 1 });
		const rise = (unit.boundingBox().max[2] - p.height) * f.slope;
		if (rise <= resolution) return s.keep(section.extrude(p.height));
		return s.keep(
			unit.warp((v) => {
				if (v[2] > p.height) v[2] = p.height + (v[2] - p.height) * f.slope;
			})
		);
	}
	const body = s.keep(section.extrude(p.height + f.width * f.slope));
	if (roof === 'sawtooth') return teeth(s, section, body, f, p.teeth);
	const rising = below(s, body, f, f.slope, f.low);
	return roof === 'gable' ? below(s, rising, f, -f.slope, f.low + f.width) : rising;
}
