import type { DistrictKind } from '../../domain/city-volume';
import type { Drawable } from '../surface';

/** A drawable of the city volume with what the focus needs to style it: the district kind and
 * height of a body, its seeded pencil draw, and whether it is the body with its wall lines, its
 * roof edges, storey lines or cell joints, a stock box or one of its lines, or a ground shade. */
export type CityDrawable = Drawable &
	Readonly<{
		kind: DistrictKind;
		levels: number;
		drawn: boolean;
		role:
			| 'body'
			| 'roof'
			| 'storeys'
			| 'joints'
			| 'block'
			| 'block-roof'
			| 'block-storeys'
			| 'contact'
			| 'cast';
		/** Ground shade falls from the boxes, or from the envelope when it is false. */
		boxShade?: boolean;
	}>;
