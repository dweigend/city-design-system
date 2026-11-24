import { PlaceableObject } from '../object';
import { createAssetRegistry } from './index';

/** Registers a metric marker and builds one at a fixed ground point. */
export function example() {
	const registry = createAssetRegistry([
		{
			id: 'marker/survey',
			kind: 'marker',
			tags: ['survey'],
			params: {},
			hostKinds: ['ground'],
			build(host) {
				if (host.kind !== 'ground') throw new RangeError('Expected a ground point');
				return PlaceableObject.create({
					id: 'survey-marker',
					slots: [],
					parts: [],
					footprint: { width: 0, depth: 0 },
					anchors: [{ name: 'survey', position: host.point, normal: [0, 0, 1] }]
				});
			}
		}
	]);
	return registry.buildAsset('marker/survey', { kind: 'ground', point: [2, 3, 0] }, {}, 17);
}
