import { STRICHE } from '../../data/leitstil';

export function strichbreite(durchmesserM: number, pxProM: number): number {
	if (!Number.isFinite(durchmesserM) || durchmesserM < 0 || !Number.isFinite(pxProM) || pxProM <= 0)
		throw new RangeError('Diameter ≥ 0 m and scale > 0 px/m required.');
	return Math.max(durchmesserM * pxProM, STRICHE.minimumTraeger);
}
