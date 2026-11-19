import { mount, type AssetRecipe } from './definition';
import { panel, collar } from './objects/forms';

export const chimney: AssetRecipe = {
	id: 'chimney',
	slotNames: ['body', 'trim', 'edge'],
	category: 'infrastructure',
	variants: ['kiln-stack', 'banded-flue', 'twin-flue'],
	footprint: [4.5, 3.3],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const count = variant === 2 ? 2 : 1;
		const height = [5.2, 7.4, 4.8][variant] + sample * 0.4;
		const radius = variant === 0 ? 0.74 : 0.58;
		const stacks = Array.from({ length: count }, (_, i) => {
			const x = (i - (count - 1) / 2) * 1.72,
				top = height - 0.65 * i;
			const shaft = [
				collar(x, 0, 0.36, radius, 0.14, top - 0.36, 'trim'),
				collar(x, 0, top, radius + 0.08, 0.22, 0.18, 'body'),
				collar(x, 0, top - 0.45, radius - 0.14, 0.06, 0.5, 'edge')
			];
			if (variant === 1)
				for (const t of [0.35, 0.7])
					shaft.push(collar(x, 0, top * t, radius + 0.025, 0.08, top * 0.08, 'body'));
			return shaft;
		}).flat();
		return [panel(0, 0, 0, count * 1.72, 1.94, 0.36, 'body'), ...stacks];
	}
};
