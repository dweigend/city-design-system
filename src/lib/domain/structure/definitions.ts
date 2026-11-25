import { defaults } from '../../../config/structure';

/** A square outside profile, its load-bearing area and optional material reference stress. */
export type MemberSection = Readonly<{
	widthM: number;
	areaM2: number;
	referenceStressKPa?: number;
	primary?: boolean;
}>;

/** Extend or override the built-in sections and roles for one immutable graph. */
export type StructureDefinitions = Readonly<{
	sections?: Readonly<Record<string, MemberSection>>;
	roles?: readonly string[];
	referenceStressKPa?: number;
}>;

/** Default section geometry and primary classification. */
export const memberSections = Object.freeze({
	light: Object.freeze({ widthM: defaults.secondaryWidthM, areaM2: defaults.secondaryAreaM2 }),
	heavy: Object.freeze({
		widthM: defaults.primaryWidthM,
		areaM2: defaults.primaryAreaM2,
		primary: true
	})
}) satisfies Readonly<Record<string, MemberSection>>;

const roles = Object.freeze(['column', 'beam', 'brace', 'tie']);

const positive = (value: number) => Number.isFinite(value) && value > 0;

export function resolveDefinitions(input: StructureDefinitions) {
	const referenceStressKPa = input.referenceStressKPa ?? defaults.nominalStressKPa;
	if (!positive(referenceStressKPa)) throw new RangeError('Invalid structural reference stress');
	const sections: Readonly<Record<string, MemberSection>> = {
		...memberSections,
		...input.sections
	};
	const sectionEntries = Object.entries(sections).map(([id, section]) => {
		const { areaM2, widthM, referenceStressKPa: stress, primary } = section;
		if (
			!validName(id) ||
			!positive(areaM2) ||
			!positive(widthM) ||
			(stress !== undefined && !positive(stress)) ||
			(primary !== undefined && typeof primary !== 'boolean') ||
			!positive(areaM2 * (stress ?? referenceStressKPa))
		)
			throw new RangeError(`Invalid structural section "${id}"`);
		return [
			id,
			Object.freeze({
				widthM,
				areaM2,
				...(stress !== undefined ? { referenceStressKPa: stress } : {}),
				...(primary !== undefined ? { primary } : {})
			})
		] as const;
	});
	const memberRoles = [...new Set([...roles, ...(input.roles ?? [])])];
	if (!memberRoles.every(validName)) throw new RangeError('Invalid structural member role');
	return Object.freeze({
		sections: Object.freeze(Object.fromEntries(sectionEntries)),
		roles: Object.freeze(memberRoles),
		referenceStressKPa
	});
}

function validName(id: string) {
	return typeof id === 'string' && id.isWellFormed() && !!id.trim() && !/\p{Cc}/u.test(id);
}

export type ResolvedDefinitions = ReturnType<typeof resolveDefinitions>;
export const defaultDefinitions: ResolvedDefinitions = Object.freeze({
	sections: memberSections,
	roles,
	referenceStressKPa: defaults.nominalStressKPa
});
