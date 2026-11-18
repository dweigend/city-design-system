import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('the prerender entry generates twelve shells with renderer imports forbidden', () => {
	const result = spawnSync(
		'bun',
		[
			'-e',
			`
 Bun.plugin({name:'headless',setup(build){
 build.onResolve({filter:/^three(?:\\/|$)/},()=>{throw new Error('Renderer imported during prerender')});
 }});
 const {load}=await import('./src/routes/labor/building-envelope/+page.server.ts');
 const {meshes}=await load();
 if(meshes.length!==12 || meshes.some(m=>m.shellIndexEnds.length!==1 || !m.indices.length))throw new Error('Invalid comparison plate');
 `
		],
		{ encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
});
