/** Reference cues and material comparisons for the building studies. */
export const materialHausWahl = [
	{
		value: 'timber',
		label: 'Timber house',
		oberflaeche: 'Upright timber',
		alternative: 'Cast concrete',
		text: 'A timber cube with punched windows sits on a thin concrete band and a dipped lime footing.'
	},
	{
		value: 'glazed',
		label: 'Glass pavilion',
		oberflaeche: 'Clear glass',
		alternative: 'Etched glass',
		text: 'Thin graphite frames hold clear glass around a red core, backed by one concrete wall.'
	},
	{
		value: 'aggregate',
		label: 'Aggregate tower',
		oberflaeche: 'Exposed aggregate',
		alternative: 'Cast concrete',
		text: 'Three plain stacked boxes in yellow aggregate. Square holes put the surface in light and shade.'
	},
	{
		value: 'painted',
		label: 'Painted tower',
		oberflaeche: 'Poured enamel',
		alternative: 'Satin paint',
		text: 'Blue paint poured over the roof hangs in raised runs down a pink mineral body.'
	},
	{
		value: 'veined',
		label: 'Veined block',
		oberflaeche: 'Veined mineral',
		alternative: 'Cast concrete',
		text: 'A pale angular block with blue fractures. Cast concrete shows the same form without veins.'
	}
] as const;

export type MaterialHausId = (typeof materialHausWahl)[number]['value'];
