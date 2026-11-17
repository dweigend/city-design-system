/**
 * Evaluates the dependency-cruiser rules of .dependency-cruiser.cjs on a graph augmented with
 * Svelte type edges and reports only findings the added edges cause.
 */
export interface GraphModule {
	source: string;
	dependencies: { resolved: string }[];
}
export interface TypeEdge {
	from: string;
	to: string;
	specifier: string;
}
interface Rule {
	name: string;
	from: { path?: string; pathNot?: string };
	to: { path?: string; pathNot?: string; circular?: boolean; reachable?: boolean };
}

const RULE_KEYS = ['name', 'comment', 'severity', 'from', 'to'];
const FROM_KEYS = ['path', 'pathNot'];
const TO_KEYS = ['path', 'pathNot', 'circular', 'reachable'];

/**
 * Throws for any dependency-cruiser rule shape this supplement does not evaluate, so a new
 * option can never be ignored silently. Supported: `from.path`, `from.pathNot`, `to.path`,
 * `to.pathNot`, `to.circular: true` and `to.reachable: true`.
 */
export function assertSupportedRules(rules: unknown[]): asserts rules is Rule[] {
	for (const rule of rules as Record<string, Record<string, unknown>>[])
		if (!isSupported(rule))
			throw new Error(`Unsupported boundary rule shape: ${String(rule.name)}`);
}

function hasOnly(value: object | undefined, keys: string[]): boolean {
	return Object.keys(value ?? {}).every((key) => keys.includes(key));
}

function isSupported(rule: Record<string, Record<string, unknown>>): boolean {
	if (!hasOnly(rule, RULE_KEYS) || !hasOnly(rule.from, FROM_KEYS) || !hasOnly(rule.to, TO_KEYS))
		return false;
	// Each graph-wide mode is either absent or exactly `true`, and a rule uses at most one.
	const modes = ['circular', 'reachable'].filter((mode) => mode in (rule.to ?? {}));
	return modes.length <= 1 && modes.every((mode) => rule.to[mode] === true);
}

/** Whether `source` satisfies a rule side's `path` and `pathNot` patterns. */
function matches(side: { path?: string; pathNot?: string }, source: string): boolean {
	if (side.path && !new RegExp(side.path).test(source)) return false;
	return !(side.pathNot && new RegExp(side.pathNot).test(source));
}

type Graph = Map<string, Set<string>>;

/** Breadth-first predecessor map of everything reachable from `start` (start excluded). */
function reach(graph: Graph, start: string): Map<string, string> {
	const parent = new Map<string, string>();
	const queue = [start];
	for (const node of queue)
		for (const next of graph.get(node) ?? [])
			if (next !== start && !parent.has(next)) {
				parent.set(next, node);
				queue.push(next);
			}
	return parent;
}

function pathTo(parent: Map<string, string>, start: string, end: string): string[] {
	const path = [end];
	while (path[0] !== start) path.unshift(parent.get(path[0]) as string);
	return path;
}

function pathBack(graph: Graph, start: string, end: string): string[] | undefined {
	if (start === end) return [start];
	const parent = reach(graph, start);
	return parent.has(end) ? pathTo(parent, start, end) : undefined;
}

function toGraph(modules: GraphModule[]): Graph {
	return new Map(modules.map((m) => [m.source, new Set(m.dependencies.map((d) => d.resolved))]));
}

/** Reachability findings that exist only because of the added type edges. */
function newReachFindings(before: Graph, after: Graph, rule: Rule): string[] {
	const findings: string[] = [];
	for (const from of after.keys()) {
		if (!matches(rule.from, from)) continue;
		const known = reach(before, from);
		const parent = reach(after, from);
		for (const to of parent.keys())
			if (!known.has(to) && matches(rule.to, to))
				findings.push(`${rule.name}: ${pathTo(parent, from, to).join(' -> ')}`);
	}
	return findings;
}

/** Check only added edges; old findings stay owned by the existing baseline gate. */
export function checkTypeEdges(modules: GraphModule[], edges: TypeEdge[], rules: Rule[]): string[] {
	const before = toGraph(modules);
	const graph = toGraph(modules);
	const added = edges.filter((e) => !before.get(e.from)?.has(e.to));
	for (const edge of edges) {
		if (!graph.has(edge.from)) graph.set(edge.from, new Set());
		graph.get(edge.from)?.add(edge.to);
	}
	const findings = rules.flatMap((rule) =>
		rule.to.reachable ? newReachFindings(before, graph, rule) : newEdgeFindings(graph, added, rule)
	);
	return [...new Set(findings)];
}

/** Direct and cycle findings caused by the added edges themselves. */
function newEdgeFindings(graph: Graph, added: TypeEdge[], rule: Rule): string[] {
	const findings: string[] = [];
	for (const edge of added) {
		if (!matches(rule.from, edge.from) || !matches(rule.to, edge.to)) continue;
		if (!rule.to.circular) {
			findings.push(`${rule.name}: ${edge.from} -> ${edge.to}`);
			continue;
		}
		const back = pathBack(graph, edge.to, edge.from);
		if (back) findings.push(`${rule.name}: ${[edge.from, ...back].join(' -> ')}`);
	}
	return findings;
}
