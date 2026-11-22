/** Reading texts of the three construction-phase houses, in building order (FORM-10). */
export const styleHouses = {
	title: 'Construction phases',
	lead: 'Bible study · Three houses stand on the same lot and reach the same height. Each one is built the way its phase builds.',
	houses: [
		{
			id: 'memphis',
			name: 'Memphis',
			caption:
				'Solid blocks stack like toys, each in its own material. A wedge, a cube and a cone make the roof.'
		},
		{
			id: 'archigram-fuller',
			name: 'Archigram / Fuller',
			caption:
				'An open frame holds capsules that can be swapped. Pipes run outside; a geodesic dome and a crane take the top.'
		},
		{
			id: 'organic',
			name: 'Organic',
			caption:
				'One trunk forks into limbs that carry soft shells. Moss grows on every shell and leaves close the crown.'
		}
	]
} as const;
