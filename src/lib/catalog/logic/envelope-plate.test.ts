import ts from 'typescript';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('the prerender entry generates twelve shells with renderer imports forbidden', () => {
	const result = spawnSync(
		'bun',
		[
			'-e',
			`
 const route='./src/routes/labor/building-envelope/+page.server.ts';
 const graph=await Bun.build({entrypoints:[route],target:'bun',external:['manifold-3d'],plugins:[{name:'headless',setup(build){
 build.onResolve({filter:/^three(?:\\/|$)/},()=>{throw new Error('Renderer imported during prerender')});
 }}]});
 if(!graph.success)throw new Error(graph.logs.join('\\n'));
 const {load}=await import(route);
 const {meshes}=await load();
 if(meshes.length!==12 || meshes.some(m=>m.shellIndexEnds.length!==1 || !m.indices.length))throw new Error('Invalid comparison plate');
 `
		],
		{ encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
});

test('the prerender route loads data exclusively from the catalog page entry', () => {
	const file = readFileSync('src/routes/labor/building-envelope/+page.server.ts', 'utf8');
	const imports = ts.preProcessFile(file).importedFiles.map((ref) => ref.fileName);
	assert.deepEqual(imports, ['#lib/catalog/labor/envelope-plate.server.ts']);
});
