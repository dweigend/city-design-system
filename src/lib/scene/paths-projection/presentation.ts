import { readDisplayPresentation } from '../focus';
import { pathsFocusPreset, type PathsFocusChoice } from './focus';
import type { Presentation } from '../stage';
import type { Drawable } from '../surface';

/** Applies the shared focus policy to the already projected movement and rail geometry. */
export function pathsPresentation(
	base: Presentation,
	paths: readonly Drawable[],
	rail: readonly Drawable[],
	route: readonly Drawable[],
	focus: PathsFocusChoice,
	showRoute: boolean
): Presentation {
	const { readFocusLevel } = pathsFocusPreset;
	const lanes = readDisplayPresentation(readFocusLevel(focus, 'lanes'));
	const walkways = readDisplayPresentation(readFocusLevel(focus, 'walkways'));
	const transit = readDisplayPresentation(readFocusLevel(focus, 'transit'));
	const drawables = [
		...paths.map((part) => ({
			...part,
			visible: (part.id === 'ground-lanes' ? lanes : walkways).visible
		})),
		...rail.map((part) => ({ ...part, visible: transit.visible })),
		...route.map((part) => ({ ...part, visible: showRoute }))
	];
	let previous: readonly Drawable[] | undefined;
	let result: readonly Drawable[] = [];
	return (viewport) => {
		const context = base(viewport);
		if (previous !== context) {
			previous = context;
			result = [...context, ...drawables];
		}
		return result;
	};
}
