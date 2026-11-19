// @ts-expect-error Bun supplies the test API at runtime.
import { expect,test } from 'bun:test';
import { deriveGrid } from '../terrain-grid';
import { createTerrain } from '../terrain';
import { applyEdit, EMPTY_STATE, frameReport,frameSurvey,type World } from './index';

test('the game advances the same seed-7 frame without changing the stock houses',()=>{
	const terrain={...createTerrain({seed:7}),along:45,across:45};
	const grid=deriveGrid(terrain);
	const stacks=new Map(grid.cells.filter(c=>c.column===4 && c.row>=2 && c.row<=6 && c.zone!=='water')
		.map(c=>[c.id,['living'] as const]));
	const world:World={grid,seed:7,lines:[],state:{...EMPTY_STATE,stacks}};
	const first=applyEdit(world,{kind:'advance',years:1});
	const second=applyEdit(first,{kind:'advance',years:1});
	expect(second.state.stacks).toBe(stacks);
	expect(first.state.stacks).toBe(world.state.stacks);
	const survey=frameSurvey(world);
	expect(survey.seams.size).toBeGreaterThan(0);
	const report=frameReport(second);
	for(const id of survey.seams.keys()) {
		const trace=report.explain(id);
		expect(trace.diagnostics).toHaveLength(12);
		expect(trace.diagnostics.find(d=>d.measure==='water-crossing')?.value).toBe(0);
	}
});
