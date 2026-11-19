import { hashUnit } from '../random';

/** Selects from cumulative weights in caller-declared canonical order, with one keyed draw. */
export function weightedForm<T extends string>(
	choices: readonly { form: T; end: number }[],
	seed: number,
	id: string,
	channel: string
): T {
	const last = choices[choices.length - 1];
	if (!last || !(last.end > 0)) throw new RangeError('Empty weighted domain');
	const draw = hashUnit(seed, id, channel) * last.end;
	return (choices.find((choice) => draw < choice.end) ?? last).form;
}
