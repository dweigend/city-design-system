import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { checkNaming } from './check-naming';

const fixtures = resolve(import.meta.dir, 'fixtures/rules/12-naming');

test('accepts operation verbs, computed nouns and named function exports', () => {
	expect(checkNaming(resolve(fixtures, 'pass'))).toEqual([]);
});

test('rejects unsupported verbs and British spelling on public functions', () => {
	expect(checkNaming(resolve(fixtures, 'fail'))).toEqual([
		'src/lib/core/probe/index.ts: buildSpan must start with a core operation verb',
		'src/lib/core/probe/index.ts: measurement must start with a core operation verb',
		'src/lib/domain/probe/index.ts: readCentre must use US English',
		'src/lib/scene/probe/index.ts: resolveColour must use US English',
		'src/lib/world/probe/index.ts: assembleSite must start with a world operation verb'
	]);
});
