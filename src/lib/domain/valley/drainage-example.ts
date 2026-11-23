import { Random } from '../../core/random';
import { generateCourse } from './course';
import { drainageTerrain } from './drainage-terrain';
import { createValleyAxis } from './valley-axis';
import { solveDrainage } from './drainage';

export function drainageExample(rows: readonly (readonly number[])[], inlet = 0, importedArea = 0) {
	const bed = Int32Array.from(rows.flat(), (height) => height * 1000);
	return solveDrainage({ side: rows.length, spacing: 100, bed }, inlet, importedArea);
}

export function regionalDrainageExample(seed: number) {
	const root = Random.create({ seed });
	const openSide = root.derive('open-bank').number() < 0.5 ? 1 : -1;
	const guide = generateCourse(root.derive('course'), 1.15, openSide, -Math.PI / 2);
	const axis = createValleyAxis(root.derive('ground'), guide, openSide);
	return drainageTerrain(guide, axis, root, 1, 1);
}
