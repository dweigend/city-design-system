export const volumeStudy = {
	title: 'Solid and void',
	description:
		'Seven filled cells form a house around two open cells. Follow the court from the entrance to the rear wall.',
	section:
		'Section through a building with an open ground-floor passage beneath a continuous deck.',
	faces: [
		{ name: 'Open scaffold', point: [3, 0, 4.82], right: false, high: true },
		{ name: 'Glazed bay', point: [9, 0, 4.5], right: true, high: true },
		{ name: 'Surface', point: [7, 0, 3.3], right: false, high: false },
		{ name: 'Closed shell', point: [16, 0, 2], right: true, high: false }
	]
} as const;
