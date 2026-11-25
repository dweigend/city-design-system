import { expect, test } from 'bun:test';
import { createMemberGraph, portalExample, runGravity } from '../../domain/structure';
import { projectStructure, structureFocusPreset, structureProjectionExample } from './index';

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

test('the structure focus separates primary filtering from utilization analysis', () => {
	const { offerFocus, readFocusLevel, readFocusChoice } = structureFocusPreset;
	expect(offerFocus(['primary-members', 'secondary-members'])).toEqual([
		'all',
		'primary',
		'utilization'
	]);
	expect(readFocusLevel('primary', 'primary-members')).toBe('full');
	expect(readFocusLevel('primary', 'secondary-members')).toBe('hidden');
	expect(readFocusLevel('utilization', 'secondary-members')).toBe('full');
	expect(readFocusChoice('utilization').analysis).toBe('utilization');
});

test('R15-07 primary classification is independent of the section key', () => {
	const { graph } = portalExample();
	const mixed = createMemberGraph({
		...graph,
		members: graph.members.map((member, index) => ({
			...member,
			section: index === 0 ? 'light' : 'heavy',
			primary: index === 0
		}))
	});
	const parts = projectStructure(mixed, { view: 'primary', supports: false });
	expect(parts.length).toBeGreaterThan(0);
	expect(parts.every(({ id }) => id.includes('/light/'))).toBe(true);
});

test('R15-03 neutral geometry reads analysis only when reactions are displayed', () => {
	const { graph, loads } = portalExample();
	let reads = 0;
	const readAnalysis = () => {
		reads++;
		return runGravity(graph, loads);
	};
	projectStructure(graph, {
		view: 'all',
		get analysis() {
			return readAnalysis();
		}
	});
	expect(reads).toBe(0);
	projectStructure(graph, {
		arrows: loads,
		get analysis() {
			return readAnalysis();
		}
	});
	expect(reads).toBe(1);
});

test('R15-07 bearing and force marker dimensions follow the supplied sizing', () => {
	const { graph, loads } = portalExample();
	const analysis = runGravity(graph, loads);
	const ordinary = projectStructure(graph, { analysis, arrows: loads });
	const sized = projectStructure(graph, {
		analysis,
		arrows: loads,
		markerSizing: { supportWidthM: 1.5, supportHeightM: 0.5, arrowReferenceKN: 1000 }
	});
	for (const slot of ['fixed-support', 'load', 'reaction']) {
		const shape = (parts: typeof sized) =>
			parts.find(({ id }) => id === 'structure/' + slot)?.shape;
		expect(shape(sized)).toBeDefined();
		expect(shape(sized)).not.toEqual(shape(ordinary));
	}
	expect(
		projectStructure(graph, {
			analysis,
			arrows: loads,
			markerSizing: { supportWidthM: undefined }
		})
	).toEqual(ordinary);
});
