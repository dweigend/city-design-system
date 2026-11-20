type Link = readonly [string, string];
/** Joins degree-two ports into ordered reaches. Endpoint identity survives coincident coordinates. */
export function routeChains(links: Link[]) {
	links = [...new Map(links.map((link) => [JSON.stringify([...link].sort()), link])).values()];
	const arms = new Map<string, Link[]>(),
		unused = new Set(links);
	for (const link of links)
		for (const id of link) {
			const row = arms.get(id) ?? [];
			row.push(link);
			arms.set(id, row);
		}
	function trace(first: Link, start: string) {
		const chain = [start];
		let edge: Link | undefined = first,
			id = start;
		while (edge) {
			unused.delete(edge);
			id = edge[0] === id ? edge[1] : edge[0];
			chain.push(id);
			edge = arms.get(id)?.find((e) => unused.has(e));
		}
		return chain;
	}
	const paths: string[][] = [];
	for (const [id, row] of arms)
		if (row.length === 1 && unused.has(row[0])) paths.push(trace(row[0], id));
	for (const edge of unused) paths.push(trace(edge, edge[0]));
	return paths;
}
