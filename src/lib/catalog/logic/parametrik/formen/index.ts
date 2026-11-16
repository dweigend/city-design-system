import type { FormFamily, FormGroup } from '../vocab';
import { klotz } from './klotz';
import { zylinder } from './zylinder';
import { kapsel } from './kapsel';
import { bogen } from './bogen';
import { rahmen } from './rahmen';
import { ring } from './ring';
import { rohr } from './rohr';
import { kopf } from './kopf';
import { huelle } from './huelle';
import { erschliessung } from './erschliessung';
import { vegetation } from './vegetation';
import { bestand } from './bestand';

/** All form families (docs/research/70-vokabular.md §2), in group order. */
export const formFamilies: FormFamily[] = [
	...klotz,
	...zylinder,
	...kapsel,
	...bogen,
	...rahmen,
	...ring,
	...rohr,
	...kopf,
	...huelle,
	...erschliessung,
	...vegetation,
	...bestand
];

export const formGroups: { id: FormGroup; name: string }[] = [
	{ id: 'klotz', name: 'Block mass' },
	{ id: 'zylinder', name: 'Cylinder' },
	{ id: 'kapsel', name: 'Capsule' },
	{ id: 'bogen', name: 'Arch' },
	{ id: 'rahmen', name: 'Frame' },
	{ id: 'ring', name: 'Ring' },
	{ id: 'rohr', name: 'Pipe' },
	{ id: 'kopf', name: 'Crown' },
	{ id: 'huelle', name: 'Envelope' },
	{ id: 'erschliessung', name: 'Circulation' },
	{ id: 'vegetation', name: 'Vegetation' },
	{ id: 'bestand', name: 'Existing stock' }
];

export const formFamily = (id: string) => formFamilies.find((f) => f.id === id);
