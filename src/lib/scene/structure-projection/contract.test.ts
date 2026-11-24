import { expect, test } from 'bun:test';
import { createMemberGraph, portalExample } from '../../domain/structure';
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
