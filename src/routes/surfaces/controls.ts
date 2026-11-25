import type { Family, SurfaceLevel } from '../../lib/domain/material';

export const familyLabels: Record<Family, string> = {
	board: 'Painted board',
	card: 'Grey board',
	cork: 'Cork',
	stripe: 'Stripe laminate',
	perforated: 'Perforated sheet',
	acrylic: 'Lit acrylic',
	ground: 'Ground'
};
export const levelLabels: Record<SurfaceLevel, string> = {
	near: 'Near',
	mid: 'Mid',
	far: 'Far',
	plain: 'Plain',
	pencil: 'Pencil'
};

/** The family shown horizontally on the sample board and around the body. */
export const groundFamily = 'ground';

/** Reads a shared URL's slider value, clamped to the same band as the on-page control. */
export function readControl(value: string | null, [min, max]: readonly [number, number, number]) {
	const number = value === null ? 1 : Number(value);
	return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 1;
}

/** Resolves a capture URL to its requested specimen, including older board links. */
export function readSpecimen(query: Pick<URLSearchParams, 'get' | 'has'>): 'body' | 'board' {
	const specimen = query.get('specimen');
	if (specimen === 'body' || specimen === 'board') return specimen;
	return query.has('show') ||
		query.has('levels') ||
		(query.has('zoom') && !query.has('body') && !query.has('bodyZoom'))
		? 'board'
		: 'body';
}
