import type { Primitive } from '../parametrik/types';
import { MODULE, type TerrainGrid } from '../terrain-grid';
import type { StructuralContact } from './index';
import { surveySlabSeam } from './slab-seam';
import { surveyGround, surveySeat, type End } from './contact-seat';
import {
	memberRuns,
	subtract,
	surfaceBounds,
	contactSurfaces,
	contactToleranceM,
	type Round,
	type Surface
} from './contact-surfaces';

type Parts = { key: string; parts: readonly Primitive[] };
type Support = { id: string; rail: boolean; slab: boolean; surface: Surface };

function bucket(x: number, y: number) {
	return Math.floor(x / MODULE) + '/' + Math.floor(y / MODULE);
}

function indexSurfaces(supports: Support[]) {
	const byLocation = new Map<string, Support[]>();
	for (const support of supports) {
		const [x0, y0, x1, y1] = surfaceBounds(support.surface);
		if (![x0, y0, x1, y1].every(Number.isFinite)) continue;
		for (
			let x = Math.floor((x0 - contactToleranceM) / MODULE);
			x <= Math.floor((x1 + contactToleranceM) / MODULE);
			x++
		)
			for (
				let y = Math.floor((y0 - contactToleranceM) / MODULE);
				y <= Math.floor((y1 + contactToleranceM) / MODULE);
				y++
			) {
				const key = x + '/' + y;
				const entries = byLocation.get(key);
				if (entries) entries.push(support);
				else byLocation.set(key, [support]);
			}
	}
	return byLocation;
}

function ends({ a, b }: Round): End[] {
	const delta = subtract(b, a);
	const length = Math.hypot(...delta);
	const [x, y, z] = delta.map((n) => n / length || 0);
	return [
		{ point: a, axis: [x, y, z], length },
		{ point: b, axis: [-x, -y, -z], length }
	];
}

function contact(
	end: End,
	site: NonNullable<ReturnType<typeof surveySeat>>,
	member: StructuralContact['member'],
	supportId: string,
	owner: string,
	built: number,
	stroke: StructuralContact['stroke']
): StructuralContact {
	const { diameter, ...seat } = site;
	return {
		...seat,
		member,
		support: { id: supportId, diameter },
		owner,
		built,
		anchor: end.point.join(','),
		axis: end.axis,
		stroke
	};
}

/** Surveys structural endpoints and post seams against visible parts in world metres.
 * A shared centreline node produces one fitting per part pair, even across drawing batches.
 */
export function sandboxStructuralContacts(
	batches: Iterable<Parts>,
	grid: TerrainGrid,
	built: number
): StructuralContact[] {
	const parts = [...batches].flatMap(({ key, parts }) =>
		parts.map((part) => ({
			part,
			key,
			id: key + '/' + part.id,
			members: memberRuns(part)
		}))
	);
	const supports = indexSurfaces(
		parts.flatMap(({ part, id, members, key }) => {
			const rail = key.startsWith('line:') && part.id.endsWith('/deck');
			// Historic wall and foundation solids also contribute endpoint bearing faces.
			const slab = !/:(?:wall|foot)$/.test(part.id);
			return contactSurfaces(part, members, rail).map((surface) => ({ id, surface, rail, slab }));
		})
	);
	const sites = new Map<string, StructuralContact>();
	for (const { part, key, id, members } of parts) {
		const stroke = part.member === 'secondary' ? 'secondary' : 'main';
		for (const run of members) {
			const member = { id, diameter: run.radius * 2 };
			for (const end of ends(run)) surveyEnd(end, member, key, stroke);
			if (part.kind === 'cylinder') surveyPost(run, member, key, stroke);
		}
	}
	return [...sites.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([, row]) => row);

	function surveyEnd(
		end: End,
		member: StructuralContact['member'],
		key: string,
		stroke: StructuralContact['stroke']
	) {
		const candidates = supports.get(bucket(end.point[0], end.point[1])) ?? [];
		for (const support of candidates) {
			if (support.id === member.id) continue;
			const site = surveySeat(end, support.surface, member.diameter, support.rail);
			if (site) store(contact(end, site, member, support.id, key, built, stroke));
		}
		const ground = surveyGround(grid, end);
		if (ground) store(contact(end, ground, member, ground.id, key, built, stroke));
	}

	function surveyPost(
		run: Round,
		member: StructuralContact['member'],
		key: string,
		stroke: StructuralContact['stroke']
	) {
		const candidates = supports.get(bucket(run.a[0], run.a[1])) ?? [];
		for (const support of candidates) {
			if (!support.slab || support.surface.kind !== 'face' || support.id === member.id) continue;
			const seam = surveySlabSeam(run, support.surface);
			if (seam) store(contact(seam.end, seam.site, member, support.id, key, built, stroke));
		}
	}

	function store(row: StructuralContact) {
		const key = JSON.stringify([[row.member.id, row.support.id].sort(), row.anchor]);
		const prior = sites.get(key);
		// Prefer a stable support when both members can mount on one another at a shared node.
		if (
			!prior ||
			row.support.diameter > prior.support.diameter ||
			(row.support.diameter === prior.support.diameter && row.support.id < prior.support.id)
		)
			sites.set(key, row);
	}
}
