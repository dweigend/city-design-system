import { FRAME_DIAMETER } from '../../data/frame-sections';
import { abtragen, STAHL, type Aufgabe } from '../statik';

/** Sizes and trims a surveyed candidate structure against the three bible diameters in metres. */
export function sizeMembers(task: Omit<Aufgabe, 'werkstoff'>) {
	const sizes = [FRAME_DIAMETER.brace, 0.14, FRAME_DIAMETER.main];
	return abtragen(
		{ ...task, werkstoff: STAHL },
		{ katalog: { rundstaebeM: sizes, rohreM: sizes } }
	);
}
