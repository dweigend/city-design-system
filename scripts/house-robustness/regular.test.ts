import { subset } from './subset';
subset('regular');

import { expect, test } from 'bun:test';
import { cases } from './sites';
import { measure } from './measure';

test('six- and seven-storey neighbours meet on the same gallery floor', () => {
	const fixture = cases('regular')[2];
	const sites = fixture.sites.map((site) => ({
		...site,
		stacks: new Map([...site.stacks].map(([id, rows]) => [id, rows.slice(1)]))
	}));
	const metrics = measure({ ...fixture, sites });
	expect(metrics.inhabitedBridges).toBeGreaterThan(0);
	expect(metrics.missingGalleries).toEqual([]);
});
