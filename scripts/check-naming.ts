import { relative, resolve } from 'node:path';
import ts from 'typescript';

// The public operation vocabulary is listed in docs/standards/NAMING_CONVENTIONS.md.
const verbs = {
	core: [
		'clip',
		'create',
		'define',
		'draw',
		'encode',
		'equal',
		'is',
		'measure',
		'move',
		'read',
		'resolve'
	],
	domain: [
		'build',
		'clip',
		'create',
		'fit',
		'has',
		'lower',
		'measure',
		'read',
		'restore',
		'run',
		'subdivide',
		'survey',
		'validate'
	],
	world: ['build', 'create', 'list', 'place', 'read', 'sample', 'validate'],
	scene: ['create', 'paint', 'plan', 'project', 'read', 'resolve', 'select', 'share', 'validate']
} as const;

// Computed queries use established result nouns. Match whole names so these do not become prefixes.
const resultNames: Record<Layer, readonly string[]> = {
	core: [
		'bounds',
		'convexHull',
		'crossProduct',
		'displacement',
		'distance',
		'dotProduct',
		'houseExample',
		'interpolation',
		'length',
		'mesh',
		'pointAt',
		'polylineLength',
		'required',
		'scaled',
		'sinuosity',
		'size',
		'squareSegment',
		'sum',
		'unitVector'
	],
	domain: [
		'cellAreaM2',
		'cellCenter',
		'cellWidth',
		'channelPolygons',
		'channelWidth',
		'cityAccessibility',
		'cityGrowth',
		'columnRoof',
		'dryPlanEdges',
		'entranceStepCellId',
		'fineCellWidth',
		'houseFaces',
		'houseFigures',
		'houseScale',
		'houseSlots',
		'houseStyleFor',
		'latticeVolumes',
		'parcelEdgeId',
		'peakHeightM',
		'planEdgeGraph',
		'planEdgeId',
		'planEdges',
		'portalExample',
		'printsMarks',
		'seamEdgeId',
		'sinuosity',
		'solidEdgeFaults',
		'stripCounts',
		'trackDirectionLength'
	],
	world: ['cityWindow', 'largestStructureExample', 'structureTownExample', 'townHouseRecipe'],
	scene: [
		'accent',
		'cityElevation',
		'cityFocus',
		'cityPresentation',
		'cityProfile',
		'faceAreaM2',
		'heightRamp',
		'houseCladdings',
		'houseDetailOf',
		'pathsPresentation',
		'shapeArrays',
		'stageExample',
		'stageNavigation',
		'structureProjectionExample',
		'terrainDrape',
		'terrainGridProjection'
	]
};

type Layer = keyof typeof verbs;

function isTypeExport(symbol: ts.Symbol) {
	return symbol.declarations?.some(
		(declaration) =>
			ts.isExportSpecifier(declaration) &&
			(declaration.isTypeOnly || declaration.parent.parent.isTypeOnly)
	);
}

/** Lists naming violations for callable exports from the four library layers. */
export function checkNaming(root: string) {
	const entries = Array.from(
		new Bun.Glob('src/lib/{core,domain,world,scene}/*/index.ts').scanSync(root),
		(path) => resolve(root, path)
	).sort();
	const program = ts.createProgram(entries, {
		baseUrl: root,
		paths: { $lib: ['src/lib'], '$lib/*': ['src/lib/*'] },
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		skipLibCheck: true,
		types: []
	});
	const checker = program.getTypeChecker();
	const violations: string[] = [];
	for (const path of entries) {
		const source = program.getSourceFile(path);
		const module = source && checker.getSymbolAtLocation(source);
		if (!source || !module) continue;
		const file = relative(root, path);
		const layer = file.split('/')[2] as Layer;
		const allowed: readonly string[] = verbs[layer];
		for (const symbol of checker.getExportsOfModule(module)) {
			if (isTypeExport(symbol)) continue;
			const target =
				symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
			if (!(target.flags & ts.SymbolFlags.Value)) continue;
			const type = checker.getTypeOfSymbolAtLocation(target, source);
			if (!type.getCallSignatures().length) continue;
			const name = symbol.getName();
			if (/centre|colour|neighbour/i.test(name)) {
				violations.push(`${file}: ${name} must use US English`);
			} else if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
				violations.push(`${file}: ${name} must use camelCase`);
			} else if (
				!allowed.includes(name.match(/^([a-z]+)(?=[A-Z]|$)/)?.[1] ?? '') &&
				!resultNames[layer].includes(name)
			) {
				violations.push(`${file}: ${name} must start with a ${layer} operation verb`);
			}
		}
	}
	return violations;
}

if (import.meta.main) {
	const violations = checkNaming(resolve(import.meta.dir, '..'));
	for (const violation of violations) console.error(violation);
	if (violations.length) process.exitCode = 1;
	else console.log('Public function names checked in core, domain, world and scene.');
}
