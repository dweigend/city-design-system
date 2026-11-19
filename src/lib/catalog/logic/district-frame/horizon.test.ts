// @ts-expect-error Bun supplies the test API at runtime.
import {expect,test} from 'bun:test';
import {planGoal,type FrameGoal,type PlanningContext} from './horizon';
import {type FrameSeam} from './seam-policy';
const edge=(id:string,a:string,b:string):FrameSeam=>({id,vertices:[a,b],houses:[id],character:'core',district:'d',districtEdge:false,use:'court',intent:'main'});
const seams=[edge('entry','a','b'),edge('jamb','b','c'),edge('run','b','d')];
const goal:FrameGoal={id:'stroke/1',literal:'entry',alternatives:['jamb'],created:0,houses:['entry','jamb']};
const ctx:PlanningContext={tick:4,lookback:2,lookahead:2,events:[],observations:[]};
const solve=(input:PlanningContext,edges=seams)=>planGoal(goal,edges,new Map(),7,input);
test('recent committed work changes the next phase on the same physical survey',()=>{
 const events=[{goal:goal.id,seam:'jamb',tick:3}];
 expect(solve(ctx).phases[0].seam).toBe('entry');
 expect(solve({...ctx,events}).phases[0].seam).toBe('jamb');
 expect(solve({...ctx,events,lookback:0}).phases[0].seam).toBe('entry');
});
test('a future promenade opening changes the first action before the main could mature',()=>{
 const observations=[{seam:'entry',from:6,reason:'promenade-opening'}];
 expect(solve({...ctx,observations,lookahead:0}).phases[0].seam).toBe('entry');
 expect(solve({...ctx,observations}).phases[0].seam).toBe('jamb');
});
test('an entry veto dates a jamb alternative and a closed jamb dates a deferral',()=>{
 const closed=seams.map(s=>s.id==='entry'?{...s,opening:'square-access'}:s);
 expect(solve(ctx,closed)).toMatchObject({goal:goal.id,reason:'square-access',phases:[{tick:4,seam:'jamb'}, {tick:5,seam:'jamb'},{}]});
 expect(solve(ctx,closed.map(s=>({...s,opening:'passage'}))).phases[0]).toEqual({tick:4,seam:null});
});
test('a new observation revises a forecast and preserves the committed snapshot',()=>{
 const old=solve(ctx),stock=new Map([['run',{built:'main' as const,builtTick:2}],['entry',{pending:'main' as const,ticks:1}]]);
 const next=planGoal(goal,seams,stock,7,{...ctx,tick:5,observations:[{seam:'entry',from:5,reason:'square-access'}]});
 expect(old.phases[1].seam).toBe('entry');
 expect(next.phases[0].seam).toBe('jamb');
 expect(next.goal).toBe(old.goal);
 expect(stock.get('run')?.builtTick).toBe(2);
});
test('64 replay seeds give identical plans with a distant district omitted',()=>{
 for(let seed=0;seed<64;seed++){
 const full=planGoal(goal,[edge('far','f','g'),...seams],new Map(),seed,ctx);
 expect(planGoal(goal,[...seams].reverse(),new Map(),seed,ctx)).toEqual(full);
 }
});
