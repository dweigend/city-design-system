import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type ObjectGeometry } from './index';

const shared = {
	'transit-crossings': 'foot',
	'stair-towers': 'slats',
	'market-canopies': 'slats',
	'inhabited-modules': 'slats'
} as const;

function tapered(part?: ObjectGeometry) {
	return part?.kind === 'mesh' && part.points.length === 36;
}
function slimLimb(part?: ObjectGeometry) {
	return part?.kind === 'capsule' && [0.055, 0.058].includes(part.radius);
}
// Recognise the released anatomy independently of the proposed material and slot.
function figureMembers(geometry: readonly ObjectGeometry[]) {
	const members = new Set<number>();
	for (const [i, head] of geometry.entries()) {
		if (head.kind !== 'sphere' || head.radius > 0.125 || !tapered(geometry[i + 1])) continue;
		members.add(i);
		members.add(i + 1);
		if (tapered(geometry[i + 2])) members.add(i + 2);
		for (let j = i + 2; j <= i + 4; j++) if (slimLimb(geometry[j])) members.add(j);
	}
	return members;
}

const wood = { token: '--paper', finish: 'holz-natur' } as const;
const brass = { token: '--ink', finish: 'metall-messing' } as const;
function checkVariant(id: string, v: string, old: string) {
	const base = buildObject(id, v, 17);
	const members = figureMembers(base.geometry);
	expect(members.size).toBeGreaterThan(0);
	expect(base.defaults[old]).toEqual({
		material: 'glaze',
		finish: 'keramik-ton',
		token: '--ink'
	});
	const saved = buildObject(id, v, 17, { slots: { [old]: wood } });
	const separate = buildObject(id, v, 17, { slots: { [old]: wood, figure: brass } });
	for (const [i, part] of base.parts.entries()) {
		const person = members.has(i);
		expect(base.geometry[i].slot === 'figure').toBe(person);
		// Covers structural members of every thickness, including those above 0.15 m.
		expect(part.finish === 'metall-graphit').toBe(person);
		if (person || base.geometry[i].slot === old) {
			expect(saved.parts[i]).toMatchObject(wood);
			expect(separate.parts[i]).toMatchObject(person ? brass : wood);
		}
	}
}

test('embedded staffage keeps graphite off structural parts and honours saved assignments', () => {
	const entries = assetRegistry.filter(
		(e) => e.category in shared || e.id.startsWith('stop-public-deck-')
	);
	expect(entries).toHaveLength(87);
	for (const entry of entries) {
		const old = shared[entry.category as keyof typeof shared] ?? 'body';
		for (const v of entry.variants) checkVariant(entry.id, v, old);
	}
});
