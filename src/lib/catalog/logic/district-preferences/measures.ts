/** Finite fixtures use one minute per directed edge and one resident per vertex. */
export function access(outgoing: number[][], doors: number[], limit: number) {
	const incoming = outgoing.map(() => [] as number[]);
	outgoing.forEach((edges, from) => {
		for (const to of edges) incoming[to].push(from);
	});
	const distance = outgoing.map(() => Infinity);
	const queue = [...new Set(doors)];
	for (const door of queue) distance[door] = 0;
	for (let i = 0; i < queue.length; i++) {
		const vertex = queue[i];
		for (const from of incoming[vertex]) {
			if (distance[from] !== Infinity) continue;
			distance[from] = distance[vertex] + 1;
			queue.push(from);
		}
	}
	return {
		cappedMean: distance.reduce((sum, d) => sum + Math.min(d, limit), 0) / distance.length,
		covered: distance.filter((d) => d <= limit).length,
		unreachable: distance.filter((d) => d === Infinity).length
	};
}

/** The taxonomy includes absent uses. Empty districts have no mix reading. */
export function mix(areas: number[]) {
	const total = areas.reduce((sum, area) => sum + area, 0);
	if (!total || areas.length < 2) return null;
	return (
		areas.reduce((sum, area) => {
			const share = area / total;
			return share ? sum - share * Math.log(share) : sum;
		}, 0) / Math.log(areas.length)
	);
}

/** Cross-section from a facade receptor to an opposite continuous parapet. */
export function section(rise: number, gap: number, sunElevations: number[]) {
	const horizon = Math.atan2(rise, gap);
	return {
		ratio: rise / gap,
		litSlots: sunElevations.filter((angle) => angle > horizon).length
	};
}

/** Each entry is kWh in one equal time slot on one unconstrained electric bus. */
export function electricity(load: number[], generation: number[]) {
	if (load.length !== generation.length) throw Error('Misaligned profiles');
	const demand = load.reduce((sum, value) => sum + value, 0);
	const deficit = load.reduce((sum, value, i) => sum + Math.max(0, value - generation[i]), 0);
	return { deficit, autonomy: demand ? (demand - deficit) / demand : null };
}

/** One crop and one nutrient. Available inputs and crop uptake use the same kg-N basis. */
export function harvest(
	potentialKg: number,
	nitrogenPerKg: number,
	recoveredN: number,
	freshN: number
) {
	const edibleKg = Math.min(potentialKg, (recoveredN + freshN) / nitrogenPerKg);
	const uptake = edibleKg * nitrogenPerKg;
	const localN = Math.min(uptake, recoveredN);
	return { edibleKg, localN, closure: uptake ? localN / uptake : null };
}
