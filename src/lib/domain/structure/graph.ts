import { distance, type Vec3 } from '../../core/geometry';
import { defaults } from '../../../config/structure';

/** Metric sections with a nominal metal area and a square outside profile. */
export const memberSections = Object.freeze({
	light: Object.freeze({ widthM: defaults.secondaryWidthM, areaM2: defaults.secondaryAreaM2 }),
	heavy: Object.freeze({ widthM: defaults.primaryWidthM, areaM2: defaults.primaryAreaM2 })
});

type Support = 'free' | 'pinned' | 'fixed';
type Role = 'column' | 'beam' | 'brace' | 'tie';

/** A joint in world XYZ meters, with Z up. */
export type StructuralJoint = Readonly<{ id: string; position: Vec3; support: Support }>;

/** An undirected connection by joint ID, with a role and section key. */
export type StructuralMember = Readonly<{
	id: string;
	from: string;
	to: string;
	role: Role;
	section: keyof typeof memberSections;
}>;

type GraphInput = Readonly<{
	joints: readonly StructuralJoint[];
	members: readonly StructuralMember[];
}>;

const validated: unique symbol = Symbol('MemberGraph');

/** Detached, validated graph in ascending code-unit order by ID. */
export type MemberGraph = GraphInput & { readonly [validated]: true };

const supports: readonly Support[] = ['free', 'pinned', 'fixed'];
const roles: readonly Role[] = ['column', 'beam', 'brace', 'tie'];

function compareId(a: { id: string }, b: { id: string }) {
	return a.id < b.id ? -1 : Number(a.id !== b.id);
}

function register(ids: Set<string>, id: string, kind: string) {
	if (typeof id !== 'string' || !id.trim() || /\p{Cc}/u.test(id))
		throw new RangeError(`Invalid ${kind} ID "${id}"`);
	if (ids.has(id)) throw new RangeError(`Duplicate ${kind} ID "${id}"`);
	ids.add(id);
}

function copyJoint(joint: StructuralJoint, ids: Set<string>) {
	const { id, support } = joint;
	const position: Vec3 = [joint.position[0], joint.position[1], joint.position[2]];
	register(ids, id, 'joint');
	if (joint.position.length !== position.length || !position.every(Number.isFinite))
		throw new RangeError(`Invalid position at joint "${id}"`);
	if (!supports.includes(support)) throw new RangeError(`Unknown support at joint "${id}"`);
	return Object.freeze({ id, position: Object.freeze(position), support });
}

function copyMember(
	{ id, from, to, role, section }: StructuralMember,
	ids: Set<string>,
	positions: ReadonlyMap<string, Vec3>
) {
	register(ids, id, 'member');
	const a = positions.get(from);
	const b = positions.get(to);
	if (!a || !b) throw new RangeError(`Dangling member "${id}"`);
	const span = distance(a, b);
	if (span === 0) throw new RangeError(`Zero-length member "${id}"`);
	if (!Number.isFinite(span)) throw new RangeError(`Invalid span at member "${id}"`);
	if (!roles.includes(role)) throw new RangeError(`Unknown role at member "${id}"`);
	if (!Object.hasOwn(memberSections, section))
		throw new RangeError(`Unknown section at member "${id}"`);
	return Object.freeze({
		id,
		from: from < to ? from : to,
		to: from < to ? to : from,
		role,
		section
	});
}

/** Validates and detaches joints and members. IDs are nonblank strings without control
 * characters, unique within each list. Throws RangeError naming invalid joints or members. */
export function createMemberGraph({ joints, members }: GraphInput): MemberGraph {
	const jointIds = new Set<string>();
	const memberIds = new Set<string>();
	const copiedJoints = Array.from(joints, (joint) => copyJoint(joint, jointIds)).sort(compareId);
	const positions = new Map(copiedJoints.map(({ id, position }) => [id, position]));
	const copiedMembers = Array.from(members, (member) =>
		copyMember(member, memberIds, positions)
	).sort(compareId);
	return Object.freeze({
		joints: Object.freeze(copiedJoints),
		members: Object.freeze(copiedMembers),
		[validated]: true as const
	});
}
