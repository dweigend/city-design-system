import { assetRegistry, buildObject, type SlotAssignment } from '../assets';
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
	const solids = assetRegistry.filter((a) => a.category === 'primitive-forms');
	const assemblies = assetRegistry.filter(
		(a) => a.id === 'ridge-house' || a.id === 'living-capsule'
	);
	return [
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
			id: 'sphere',
			label: 'One sphere in every finish',
			dimensions: '4 m diameter',
			samples: finishCatalogue.map(({ id, name }) => ({
				id,
				label: name,
				parts: () =>
					buildObject('primitive-sphere', 'short', 17, {
						slots: { body: { finish: id, token } }
					}).parts.map((part): Primitive =>
						part.kind === 'sphere'
							? { ...part, radius: 2, squash: 1, position: [0, 0, 2], fine: true }
							: part
					)
			}))
		},
		{
			id: 'corrugated',
			label: 'Corrugated sheet on every form',
			samples: [...solids, ...assemblies].map((a) => ({
				id: a.id,
				label: a.id.replace('primitive-', '').replaceAll('-', ' '),
				parts: () =>
					buildObject(a.id, a.variants[0], 17, {
						slots: Object.fromEntries(
							a.slotNames.map((slot) => [slot, { finish: 'corrugated-metal', token }])
						)
					}).parts
			}))
		}
	];
}
