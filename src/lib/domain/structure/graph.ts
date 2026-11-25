import { distance, type Vec3 } from '../../core/geometry';
import {
	defaultDefinitions,
	resolveDefinitions,
	type MemberSection,
	type ResolvedDefinitions,
	type StructureDefinitions
} from './definitions';

type Support = 'free' | 'pinned' | 'fixed';

/** A joint in world XYZ meters, with Z up. */
export type StructuralJoint = Readonly<{ id: string; position: Vec3; support: Support }>;

/** An undirected connection by joint ID, with a role and section key. */
export type StructuralMember = Readonly<{
	id: string;
	from: string;
	to: string;
	role: string;
	section: string;
	primary?: boolean;
}>;

type GraphInput = Readonly<{
	joints: readonly StructuralJoint[];
	members: readonly StructuralMember[];
	definitions?: StructureDefinitions;
}>;

const validated: unique symbol = Symbol('MemberGraph');

/** Detached, validated graph in ascending code-unit order by ID. */
export type MemberGraph = Omit<GraphInput, 'definitions'> & {
	readonly definitions?: ResolvedDefinitions;
	readonly [validated]: true;
};

const supports: readonly Support[] = ['free', 'pinned', 'fixed'];

/** Reads the validated section used by a member of this graph. */
export function readMemberSection(graph: MemberGraph, key: string): MemberSection {
	const sections = (graph.definitions ?? defaultDefinitions).sections;
	if (!Object.hasOwn(sections, key)) throw new RangeError(`Unknown structural section "${key}"`);
	return sections[key];
}

/** Resolves primary classification from the member and its section. */
export function readMemberPrimary(graph: MemberGraph, member: StructuralMember): boolean {
	return member.primary ?? readMemberSection(graph, member.section).primary ?? false;
}

/** Encodes a role and section as the member's geometry slot. */
export function readMemberSlot({ role, section }: StructuralMember): string {
	return `${encodeURIComponent(role)}/${encodeURIComponent(section)}`;
}

function compareId(a: { id: string }, b: { id: string }) {
	return a.id < b.id ? -1 : Number(a.id !== b.id);
}

function register(ids: Set<string>, id: string, kind: string) {
	if (typeof id !== 'string' || !id.trim() || /\p{Cc}/u.test(id))
		throw new RangeError(`Invalid ${kind} ID "${id}"`);
	if (ids.has(id)) throw new RangeError(`Duplicate ${kind} ID "${id}"`);
	ids.add(id);
}

// Exact arithmetic: a world position has three XYZ coordinates.
const positionSize = /* Exact arithmetic: XYZ coordinate stride. */ 3;

function copyPosition(value: unknown): Vec3 | undefined {
	if (!Array.isArray(value) || value.length !== positionSize) return undefined;
	const position = [value[0], value[1], value[2]] as Vec3;
	return position.every(Number.isFinite) ? Object.freeze(position) : undefined;
}

function copyJoint(joint: StructuralJoint, ids: Set<string>) {
	const { id, support } = joint;
	register(ids, id, 'joint');
	const position = copyPosition(joint.position);
	if (!position) throw new RangeError(`Invalid position at joint "${id}"`);
	if (!supports.includes(support)) throw new RangeError(`Unknown support at joint "${id}"`);
	return Object.freeze({ id, position, support });
}

function copyMember(
	{ id, from, to, role, section, primary }: StructuralMember,
	ids: Set<string>,
	positions: ReadonlyMap<string, Vec3>,
	{ roles, sections }: ResolvedDefinitions
) {
	register(ids, id, 'member');
	const a = positions.get(from);
	const b = positions.get(to);
	if (!a || !b) throw new RangeError(`Dangling member "${id}"`);
	const span = distance(a, b);
	if (span === 0) throw new RangeError(`Zero-length member "${id}"`);
	if (!Number.isFinite(span)) throw new RangeError(`Invalid span at member "${id}"`);
	if (!roles.includes(role)) throw new RangeError(`Unknown role at member "${id}"`);
	if (typeof section !== 'string' || !Object.hasOwn(sections, section))
		throw new RangeError(`Unknown section at member "${id}"`);
	if (primary !== undefined && typeof primary !== 'boolean')
		throw new RangeError(`Invalid primary classification at member "${id}"`);
	return Object.freeze({
		id,
		from: from < to ? from : to,
		to: from < to ? to : from,
		role,
		section,
		...(primary !== undefined && { primary })
	});
}

/** Validates and detaches joints and members. IDs are nonblank strings without control
 * characters, unique within each list. Throws RangeError naming invalid joints or members. */
export function createMemberGraph({ joints, members, definitions }: GraphInput): MemberGraph {
	const resolved = definitions ? resolveDefinitions(definitions) : defaultDefinitions;
	const jointIds = new Set<string>();
	const memberIds = new Set<string>();
	const copiedJoints = Array.from(joints, (joint) => copyJoint(joint, jointIds)).sort(compareId);
	const positions = new Map(copiedJoints.map(({ id, position }) => [id, position]));
	const copiedMembers = Array.from(members, (member) =>
		copyMember(member, memberIds, positions, resolved)
	).sort(compareId);
	return Object.freeze({
		joints: Object.freeze(copiedJoints),
		members: Object.freeze(copiedMembers),
		...(definitions && { definitions: resolved }),
		[validated]: true as const
	});
}
