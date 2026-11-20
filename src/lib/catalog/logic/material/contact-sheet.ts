import { buildingPalette } from './building-palette';
import type { HouseUse } from '../../data/house-body';
import { buildObject, type SlotAssignment } from '../assets';
import type { ColorToken, Primitive } from '../parametrik/types';
import { finishCatalogue } from './surface';

export type SheetRow = {
	id: string;
	label: string;
	dimensions?: string;
	samples: { id: string; label: string; parts(): Primitive[] }[];
};

const windowAssignments: Record<string, Record<string, SlotAssignment>> = {
	porcelain: {
		body: { finish: 'keramik-glasiert', token: '--paper' },
		glass: { finish: 'glas-klar', token: '--cat-nature-2' }
	},
	timber: {
		body: { finish: 'holz-natur', token: '--body-living' },
		glass: { finish: 'glas-matt', token: '--paper' }
	},
	enamel: {
		body: { finish: 'metall-lackiert', token: '--cat-health' },
		glass: { finish: 'acryl-matt', token: '--cat-mobility' }
	}
};

/** Compares finishes on registered geometry with the same slot binding used for placed objects. */
export function materialSheet(token: ColorToken): SheetRow[] {
	const programmes: HouseUse[] = ['living', 'water', 'energy', 'food', 'material'];
	return [
		{
			id: 'town-palette',
			label: 'Ensemble shells',
			samples: programmes.map((use) => {
				const family = buildingPalette(use, use);
				return {
					id: use,
					label: use + ' · ' + finishName(family.shell.finish),
					parts: () =>
						buildObject('living-capsule', 'twin', 17, {
							slots: { body: family.shell, glass: family.pane, accent: family.fitting }
						}).parts
				};
			})
		},
		{
			id: 'construction',
			label: 'Construction details',
			samples: constructionDetails()
		},
		{
			id: 'slot-assignments',
			label: 'One porthole, three surface assignments',
			samples: Object.entries(windowAssignments).map(([id, slots]) => ({
				id,
				label: id,
				parts: () => buildObject('porthole', 'round', 17, { slots }).parts
			}))
		},
		{
			id: 'finishes',
			label: 'Facade finishes',
			samples: finishCatalogue.map(({ id, name }) => ({
				id,
				label: name,
				parts: () =>
					buildObject('envelope-panel', 'cushioned', 17, {
						slots: { body: { finish: id, token } }
					}).parts
			}))
		}
	];
}

function finishName(id: SlotAssignment['finish']) {
	return finishCatalogue.find((f) => f.id === id)?.name ?? id;
}

function constructionDetails() {
	const family = buildingPalette('water', 'water');
	const sample = (
		id: string,
		variant: string,
		label: string,
		slots: Record<string, SlotAssignment>
	) => ({
		id,
		label,
		parts: () => buildObject(id, variant, 17, { slots }).parts
	});
	return [
		sample('kit-gallery-walk-5m', 'three-post', 'Terrazzo gallery', {
			deck: family.deck,
			frame: family.frame
		}),
		sample('kit-parapet-solid-5m', 'medium', 'Punched screen · brass cap', {
			deck: family.screen,
			edge: family.fitting
		}),
		sample('porthole', 'ringed', 'Frosted acrylic · brass bezel', {
			glass: family.pane,
			body: family.fitting,
			accent: family.frame
		})
	];
}
