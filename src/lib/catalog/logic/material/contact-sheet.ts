import { assetRegistry, buildAsset } from '../assets';
import type { ColorToken, Primitive } from '../parametrik/types';
import { forms } from './sample-forms';
import { applySurface, finishCatalogue } from './surface';

export type SheetRow = {
	id: string;
	label: string;
	dimensions?: string;
	samples: { id: string; label: string; parts(): Primitive[] }[];
};

/** Compares finishes on the same sphere and corrugation on primitive and assembled forms. */
export function materialSheet(token: ColorToken): SheetRow[] {
	const corrugate = (parts: Primitive[]) =>
		parts.map((p) => applySurface(p, 'corrugated-metal', token));
	const solids = Object.values(forms).filter((p) => p.kind !== 'polyline');
	const assemblies = assetRegistry.filter(
		(a) => a.id === 'ridge-house' || a.id === 'living-capsule'
	);
	return [
		{
			id: 'sphere',
			label: 'One sphere in every finish',
			samples: finishCatalogue.map(({ id, name }) => ({
				id,
				label: name,
				parts: () => [applySurface(forms.sphere, id, token)]
			}))
		},
		{
			id: 'corrugated',
			label: 'Corrugated sheet on every form',
			samples: [
				...solids.map((p) => ({ id: p.kind, label: p.kind, parts: () => corrugate([p]) })),
				...assemblies.map((a) => ({
					id: a.id,
					label: a.id.replaceAll('-', ' '),
					parts: () => corrugate(buildAsset(a.id, a.variants[0], 17))
				}))
			]
		}
	];
}
