import { STORY } from '../../data/grid';
import type { HouseObstacle } from '../composed-house';
import type { QuadGrid } from '../quad-grid';
import type { SandboxState } from './state';

/** Conservative occupied boxes for consecutive historic or installed storeys on the cut plots. */
export function houseObstacles(grid: QuadGrid, state: SandboxState): HouseObstacle[] {
	const obstacles: HouseObstacle[] = [];
	for (const [id, stories] of state.storyParts) {
		const cell = grid.cellsById.get(id);
		if (!cell) continue;
		const xs = cell.corners.map((p) => p[0]),
			ys = cell.corners.map((p) => p[1]);
		const w = Math.max(...xs) - Math.min(...xs),
			d = Math.max(...ys) - Math.min(...ys);
		let start = 0;
		stories.forEach((story, i) => {
			if (story.style === 'composed') {
				start = i + 1;
				return;
			}
			if (i + 1 === stories.length || stories[i + 1].style === 'composed')
				obstacles.push({
					cell: id,
					position: [Math.min(...xs) + w / 2, Math.min(...ys) + d / 2, cell.pad + STORY * start],
					size: [w, d, (i + 1 - start) * STORY]
				});
		});
	}
	return obstacles;
}
