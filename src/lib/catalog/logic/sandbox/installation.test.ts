// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
import { beginStroke, commit, createWorld, extendStroke, startHistory, undo, withState } from './index';

const town = createWorld(7);
const roofs = ['30/40', '32/40', '34/40'];
const base = withState(town, { ...town.state, year: 2027, stacks: new Map(roofs.map(id => [id, ['living'] as const])) });
const carrier = (ids: string[], world = base) => ids.reduce(extendStroke, beginStroke({ kind:'house', use:'water' }, world));
test('one stroke records one connected roof carrier with E identities and undoes it together', () => {
 const built = carrier(roofs).draft.state;
 expect(built.compositions.size).toBe(1);
 expect(built.parts.size).toBeGreaterThan(3);
 for (const p of built.parts.values()) {
  expect(p.id).toMatch(/^p\/1\/\d+$/);
  expect(p.owner).toBe('c/1');
  expect(roofs).toContain(p.anchor.cellId);
 }
 expect(undo(commit(startHistory(base.state),built)).present).toBe(base.state);
});
test('a disconnected stroke marks the gap and commits nothing', () => {
 const ids=['30/40','50/40'];
 const w=withState(base,{...base.state,stacks:new Map(ids.map(id=>[id,['living'] as const]))});
 const stroke=carrier(ids,w);
 expect(stroke.draft).toBe(w);
 expect(stroke.failure?.reason).toBe('span-disconnected');
 expect(stroke.failure?.marks.length).toBeGreaterThan(0);
});
test('totem without a supporting carrier leaves the survey intact', () => {
 const w=withState(base,{...base.state,year:2028});
 const stroke=carrier(roofs,w);
 expect(stroke.draft).toBe(w);
 expect(stroke.failure?.reason).toBe('no-dock-group');
});
test('a short walkway cannot leave an isolated landing',()=>{
 const stroke=extendStroke(beginStroke({kind:'line',transit:'walkway'},base),roofs[0]);
 expect(stroke.draft).toBe(base);
 expect(stroke.failure?.reason).toBe('short-span');
});
