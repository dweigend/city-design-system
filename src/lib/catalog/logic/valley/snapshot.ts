import type { RiverCourse } from './course';
import type { VALLEY_FLOORS } from './ground-profile';

export type Valley = Readonly<{
	version: 'valley/3';
	seed: number;
	course: RiverCourse;
	floors: typeof VALLEY_FLOORS;
	tributaries: readonly [];
	valleySlope: number;
}>;
