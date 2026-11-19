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
 const assert = (await import('node:assert/strict')).default;
 const hash = (await import('node:crypto')).createHash('sha256');
 for (const mesh of meshes) {
   hash.update(JSON.stringify(mesh.origin));
   hash.update(mesh.positions);
   hash.update(mesh.indices);
   hash.update(JSON.stringify(mesh.shellIndexEnds));
 }
 assert.equal(hash.digest('hex'), '5be68745abe9c26f81a14c0426a6419a01df3b91850e6513c98d556debda6547');
 assert.deepEqual(meshes.map(m=>m.material), [...Array(9).fill('paper'), ...Array(3).fill('glaze')]);
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
