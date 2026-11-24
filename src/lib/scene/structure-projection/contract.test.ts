import { expect, test } from 'bun:test';
import { createMemberGraph, portalExample, runGravity } from '../../domain/structure';
import { projectStructure, structureProjectionExample } from './index';

test('draws the portal in role batches with distinct reaction, load and bearing slots', () => {
	const parts = structureProjectionExample();
	const ids = parts.map(({ id }) => id);
	expect(ids).toContain('structure/fixed-support');
	expect(ids).toContain('structure/pinned-support');
	expect(ids).toContain('structure/load');
	expect(ids).toContain('structure/reaction');
	expect(ids.filter((id) => id.startsWith('structure/column/heavy/')).length).toBeGreaterThan(1);
	expect(parts.every(({ shape }) => shape.kind === 'mesh')).toBe(true);
});

test('primary view removes light members and the empty graph returns no drawables', () => {
	const { graph } = portalExample();
	const mixed = createMemberGraph({
		...graph,
		members: graph.members.map((member) =>
			member.role === 'beam' ? { ...member, section: 'light' } : member
		)
	});
	expect(projectStructure(mixed).some(({ id }) => id.includes('/light/'))).toBe(true);
	expect(
		projectStructure(mixed, { view: 'primary' }).some(({ id }) => id.includes('/light/'))
	).toBe(false);
	expect(projectStructure(createMemberGraph({ joints: [], members: [] }))).toEqual([]);
});

test('separates utilization at 100% from three progressively higher overload bands', () => {
	const { graph, loads } = portalExample();
	const result = runGravity(graph, loads);
	const colorAt = (utilization: number) => {
		const analysis = {
			...result,
			members: result.members.map((member) => ({ ...member, utilization }))
		};
		const parts = projectStructure(graph, { view: 'utilization', analysis });
		const part = parts.find(({ id }) => id.startsWith('structure/column/heavy/'));
		expect(part).toBeDefined();
		expect(part?.stroke?.color).toBe(part?.color);
		return part?.color;
	};
	expect(new Set([1, 1.01, 1.5, 2].map(colorAt)).size).toBe(4);
	expect(colorAt(1.49)).toBe(colorAt(1.01));
	expect(colorAt(1.99)).toBe(colorAt(1.5));
	expect(colorAt(10)).toBe(colorAt(2));
});
