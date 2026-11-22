import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const contentChapter = {
	number: 9,
	slug: 'inhalte',
	title: 'Content and background',
	summary:
		'Stories about sustainability, architectural styles and utopias explain the city, with sources and pictures from its engine.',
	steps: [
		placeholder(1, {
			label: 'Influences',
			title: 'An avant-garde stance',
			caption:
				'Memphis, Archigram, Fuller, the Metabolists: pick an influence and see which parts of the district borrow from it.',
			principles: ['CITY-1'],
			view: 'iso',
			detailsLabel: 'Read the story'
		}),
		placeholder(2, {
			label: 'Circular economy',
			title: 'Nothing is lost, and less is more',
			caption:
				'Two loops run through the district: a technical one for parts, a biological one for food and soil. Recycling is the second-to-last rung.',
			principles: [],
			view: 'plan',
			detailsLabel: 'Read the story'
		}),
		placeholder(3, {
			label: 'Boundaries',
			title: 'A floor and a ceiling',
			caption:
				'A district needs a floor that no one falls below and a ceiling it must not break. Move consumption and watch both.',
			principles: [],
			view: 'plan',
			detailsLabel: 'Read the story'
		}),
		placeholder(4, {
			label: 'Conversion',
			title: 'Build on, not new',
			caption:
				'Demolish and rebuild, or convert? The carbon already built into a house is lost the day it comes down.',
			principles: ['CITY-3'],
			view: 'iso',
			detailsLabel: 'Read the story'
		}),
		placeholder(5, {
			label: 'Utopias',
			title: 'Utopias that were never built',
			caption:
				'Plug-in City, Walking City, Ville Spatiale: most stayed on paper. Pick one and see it land in the district.',
			principles: ['CITY-1'],
			view: 'iso',
			detailsLabel: 'Read the story'
		}),
		placeholder(6, {
			label: 'Habitat',
			title: 'Room for other species',
			caption:
				'Cities keep only a fraction of native birds and plants. Land cover decides most, so courts, roofs and banks count.',
			principles: [],
			view: 'iso',
			detailsLabel: 'Read the story'
		})
	]
} as const satisfies Chapter;
