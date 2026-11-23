import { solveDrainage } from './drainage';

export function drainageExample(rows: readonly (readonly number[])[], inlet = 0, importedArea = 0) {
	const bed = Int32Array.from(rows.flat(), (height) => height * 1000);
	return solveDrainage({ side: rows.length, spacing: 100, bed }, inlet, importedArea);
}
