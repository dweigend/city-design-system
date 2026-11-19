import type { Primitive } from '../parametrik/types';

type GeometryOf<P> = P extends Primitive
	? Omit<P, 'token' | 'material' | 'finish' | 'overprint' | 'topToken' | 'printBand'> & {
			slot: string;
		}
	: never;
export type ObjectGeometry = GeometryOf<Primitive>;
