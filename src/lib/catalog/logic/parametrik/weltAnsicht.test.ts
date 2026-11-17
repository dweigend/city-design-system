import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { farbcodes, fokusse, welt, weltDefaults } from './welt';

// Pre-cache implementation: complete world output, size 3, seed 45, all twelve views.
const vorher: Record<string, string> = {
	'strom/alle': '45b8923bf370ecdef469687af656c454098b5cfcd4947f71481a9202dd1b189f',
	'strom/netze': '7c29b9b37da2831fde9afb0ee408ed2ffc7a0fd4d9893f6362cdaaba884733ac',
	'strom/volumen': 'eb4f66458f947ff64e3044203cc7e7b8a0c70b4a71a4840bd94ebe82916054ae',
	'45/alle': 'eab91a58ffe591dce5b1cd7c72ac04e6b6183e7c852fe4d8c0122ebc73e4899b',
	'45/netze': 'a76f7f3924bb4d884e390a59e63b88d79c9793e8436ff38dc3c2948dd08f6115',
	'45/volumen': '9e0297a9ed1ff3808a023058e35d5a8ac255d37a4e11a0af70d49704042279ca',
	'36/alle': 'f0638d312ea2cd2f001eda115ef5fbbce7fb65229c8b38fc76ea40aaacd9b0be',
	'36/netze': '7c29b9b37da2831fde9afb0ee408ed2ffc7a0fd4d9893f6362cdaaba884733ac',
	'36/volumen': '159b7c6bed8495d2d805b9874d61417633dd925b4c21fff457703c1fa61ef926',
	'43/alle': 'da157f81a7163e12ca6811172e130257a14a7981f59e3b334a82843f6bf559b1',
	'43/netze': '6fc2ed55cafcfa1aaa650a718778d23c909c2d90b50f3dc31af0955fcb7c497f',
	'43/volumen': '6689d88cd0170ddfcc29487f6ea40a2ad9272acb8c37595a552061b6690fe502'
};

test('views share the path network and keep exactly the previous primitives', () => {
	const p = { ...weltDefaults, groesse: 3 };
	const basis = welt(p);
	for (const c of farbcodes)
		for (const f of fokusse) {
			const params = { ...p, farbcode: c.id, fokus: f.id };
			const w = welt(params);
			expect(w.tour).toBe(basis.tour);
			expect(createHash('sha256').update(JSON.stringify(w)).digest('hex')).toBe(
				vorher[`${c.id}/${f.id}`]
			);
			expect(welt(params)).toBe(w);
		}
});

// Every structural input invalidates the snapshot, even when a view has been cached.
for (const change of [
	{ seed: 7 },
	{ groesse: 4 },
	{ dichte: 0.6 },
	{ hoehe: 0.6 },
	{ schwamm: 0.6 },
	{ raster: 'dreieck' as const },
	{ mass: 1.1 },
	{ verzug: 0.3 },
	{ relax: 1 }
])
	test(`structure cache discards views on ${JSON.stringify(change)}`, () => {
		const p = { ...weltDefaults, groesse: 3 };
		const before = welt(p);
		expect(welt({ ...p, ...change }).tour).not.toBe(before.tour);
	});
