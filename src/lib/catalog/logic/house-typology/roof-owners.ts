import { penetration, profile, type Profile } from './fit-geometry';
import { bearingCourses } from './perimeter';
import { layout } from './layout';
import type { EnsembleContext } from './ensemble-context';
import type { Survey } from './survey';

function touch(a: Profile, b: Profile) {
	const eps = 1e-8;
	if (
		a.bounds.min.some(
			(v, k) => v > b.bounds.max[k] + eps || b.bounds.min[k] > a.bounds.max[k] + eps
		)
	)
		return false;
	const one = a.faces ?? [a.polygon ?? a.bottom],
		two = b.faces ?? [b.polygon ?? b.bottom];
	return one.some((p) => two.some((q) => penetration(p, q) >= -eps));
}

/** Selects one roof owner per component of touching occupied volumes and bearing decks. */
export function roofOwners(sites: Survey[], context: EnsembleContext) {
	const sections = new Map(
		sites.map((site) => {
			const { plan } = layout(site, context);
			const { parts, top } = bearingCourses(plan, context);
			return [site, { shapes: parts.map(profile), top }] as const;
		})
	);
	const linked = (a: Survey, b: Survey) =>
		sections.get(a)?.shapes.some((p) => sections.get(b)?.shapes.some((q) => touch(p, q)));
	const owners = new Set<string>(),
		pending = new Set(sites);
	for (const first of pending) {
		const group = [first];
		pending.delete(first);
		for (const member of group)
			for (const other of pending)
				if (linked(member, other)) {
					group.push(other);
					pending.delete(other);
				}
		group.sort(
			(a, b) =>
				(sections.get(b)?.top ?? b.ground) - (sections.get(a)?.top ?? a.ground) ||
				a.id.localeCompare(b.id)
		);
		owners.add(group[0].id);
	}
	return owners;
}
