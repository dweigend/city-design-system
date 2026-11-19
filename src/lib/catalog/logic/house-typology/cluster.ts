import { objectSlot, worldSize } from './objects';
import type { HouseUse } from '../../data/house-body';
import type { Level, Plan, Point } from './types';

/** One tangential capsule per quarter turn. Its console connects the cradle to the common mast. */
export function clusterLevel(plan: Plan, i: number, z: number, use: HouseUse): Level {
	const { site } = plan,
		[cx, middle] = site.center,
		cy = middle - (plan.sign * site.accessDepth) / 2,
		angle = site.programme.length === 1 ? (-plan.sign * Math.PI) / 2 : (i * Math.PI) / 2;
	const u = Math.round(Math.cos(angle)),
		v = Math.round(Math.sin(angle));
	const id = site.id + '/level/' + i + '/body/0';
	const free =
		site.programme.length === 1 ? site.width : Math.min(site.width, site.depth - site.accessDepth);
	const length = free >= 10 ? 10 : free >= 6.375 ? 7.5 : 5;
	const body = objectSlot(
		id,
		['kit-capsule-ribbon-' + String(length).replace('.', 'p') + 'm', 'round-shoulder', 'capsule'],
		use,
		plan.seed,
		angle + Math.PI / 2
	);
	const scale = Math.min(1.15, free / length);
	body.scale = scale;
	body.size = body.nativeSize.map((v) => v * scale) as Point;
	const span = u ? site.width : site.depth - site.accessDepth;
	const reach = Math.min(3.25, span / 2 - 1.25 * scale, ((length * scale) / 0.6 - 2.5 * scale) / 2);
	body.position = [cx + u * reach, cy + v * reach, z + 0.3];
	body.facing = [-u, -v];
	const [bw, bd] = worldSize(body);
	const cradle = length === 7.5 ? 2.8 : 2.2;
	const width = u ? reach + 2.15 : cradle,
		depth = v ? reach + 2.15 : cradle;
	const x = cx + u * (reach / 2 + 0.175),
		y = cy + v * (reach / 2 + 0.175);
	const outline: Point[] = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([a, b]) => [x + (a * width) / 2, y + (b * depth) / 2, z]);
	return {
		position: [x, y, z],
		width,
		depth,
		outline,
		round: false,
		deckArea: width * depth,
		landing: [body.position[0] - (u * bw) / 2, body.position[1] - (v * bd) / 2, z],
		bodies: [body],
		use,
		kind: 'capsule',
		programme: site.programme[i]
	};
}
