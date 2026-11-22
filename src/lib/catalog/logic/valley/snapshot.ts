import type { RiverCourse } from './course';
import type { ValleyAxis } from './valley-axis';

export type Valley = Readonly<{
	version: 'valley/5';
	seed: number;
	course: RiverCourse;
	axis: ValleyAxis;
	floors: ValleyAxis['floors'];
	tributaries: readonly [];
	valleySlope: number;
}>;
