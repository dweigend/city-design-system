import { blockInputs } from '../data/block-inputs';
import { pendingContracts } from '../data/chapters';
import { blockDemos } from './block-demos';
import { readContractDocs } from './contract-docs';

const contracts = import.meta.glob<string>(['../*/CONTRACT.md', '../*/*/CONTRACT.md'], {
	query: '?raw',
	import: 'default',
	eager: true
});
const pendingKeys = new Set<string>(pendingContracts.map(({ key }) => key));
const sources = Object.fromEntries(
	Object.entries(contracts)
		.map(([path, markdown]) => [path.slice(3, -'/CONTRACT.md'.length), markdown] as const)
		.filter(([key]) => !pendingKeys.has(key))
);

export const contractDocs = readContractDocs(
	sources,
	blockInputs,
	new Set(Object.keys(blockDemos))
);
