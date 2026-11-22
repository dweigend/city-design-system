import { Random } from './index';

export function example(): { first: number; continued: number; child: string[] } {
	const random = Random.create({ seed: 7 });
	const first = random.number();
	return {
		first,
		continued: random.copy().number(),
		child: random.derive('structure').sample(['court', 'tower', 'hall'])
	};
}
