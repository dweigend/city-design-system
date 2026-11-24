import { createCatalog } from './index';

/** Finds the registered markers in order. */
export function example() {
	const catalog = createCatalog({
		rows: [
			{ id: 'survey/east', kind: 'marker' },
			{ id: 'access/north', kind: 'entrance' },
			{ id: 'survey/west', kind: 'marker' }
		]
	});
	return catalog.list((row) => row.kind === 'marker');
}
