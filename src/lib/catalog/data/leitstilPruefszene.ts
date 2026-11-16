/** Schematic diameters, not structural sizing. World coordinates in meters, z up. */
const staebe: {
	a: [number, number, number];
	b: [number, number, number];
	durchmesser: number;
	art: 'zug' | 'druck' | 'null';
}[] = [];
// Four bays span the wall tops at x ±8; the top chord connects the apexes.
for (let x = -8; x < 8; x += 4)
	for (let y = -4.5; y < 4.5; y += 3) {
		const a: [number, number, number] = [x, y, 8],
			b: [number, number, number] = [x + 4, y, 8],
			c: [number, number, number] = [x, y + 3, 8],
			d: [number, number, number] = [x + 4, y + 3, 8],
			t: [number, number, number] = [x + 2, y + 1.5, 10.12];
		for (const p of [a, b, c, d]) staebe.push({ a: p, b: t, durchmesser: 0.19, art: 'druck' });
		staebe.push({ a, b, durchmesser: 0.25, art: 'zug' }, { a, b: c, durchmesser: 0.1, art: 'zug' });
		if (x === 4) staebe.push({ a: b, b: d, durchmesser: 0.1, art: 'zug' });
		if (y === 1.5) staebe.push({ a: c, b: d, durchmesser: 0.25, art: 'zug' });
		if (x < 4) staebe.push({ a: t, b: [x + 6, y + 1.5, 10.12], durchmesser: 0.22, art: 'druck' });
		if (y < 1.5) staebe.push({ a: t, b: [x + 2, y + 4.5, 10.12], durchmesser: 0.15, art: 'druck' });
	}
// End triangles also bring the top chord down to the supports.
for (const x of [-8, 8])
	for (const y of [-3, 0, 3])
		staebe.push({
			a: [x, y, 8],
			b: [x === -8 ? -6 : 6, y, 10.12],
			durchmesser: 0.22,
			art: 'druck'
		});
// Capsule hung from four bottom-chord nodes, down to the floor slab.
for (const x of [-4, 4])
	for (const y of [-1.5, 1.5])
		staebe.push({ a: [x, y, 8], b: [x, y, 4], durchmesser: 0.05, art: 'zug' });
export const pruefszene = {
	bestand: [
		{ min: [-18, -5.7, 0], max: [-8, 5.7, 8] },
		{ min: [8, -5.7, 0], max: [18, 5.7, 8] }
	],
	staebe,
	koerper: [
		{ rolle: 'huelle', min: [-5, -3, 4], max: [5, 3, 4.2] },
		{ rolle: 'huelle', min: [-5, -3, 7.5], max: [5, 3, 7.7] },
		{ rolle: 'huelle', min: [-5, 2.8, 4.2], max: [5, 3, 7.5] },
		{ rolle: 'huelle', min: [-5, -3, 4.2], max: [-4.8, 3, 7.5] },
		{ rolle: 'huelle', min: [4.8, -3, 4.2], max: [5, 3, 7.5] },
		{
			rolle: 'raum',
			teil: 'boden',
			strom: 'people',
			min: [-4.8, -2.8, 4.21],
			max: [4.8, 2.8, 4.25]
		},
		{
			rolle: 'raum',
			teil: 'rueckwand',
			strom: 'people',
			min: [-4.8, 2.74, 4.25],
			max: [4.8, 2.78, 7.4]
		},
		{ rolle: 'raum', teil: 'kern', strom: 'people', min: [2, 1, 4.25], max: [3, 2.7, 7.4] },
		{ rolle: 'raum', teil: 'tuer', strom: 'people', min: [-3, 2.7, 4.25], max: [-1.8, 2.73, 6.7] }
	],
	wege: [
		{
			punkte: [
				[-5, -3.8, 4],
				[6, -3.8, 4]
			],
			breite: 1.3
		},
		{
			punkte: [
				[6, -3.8, 4],
				[6, -10, 0]
			],
			breite: 1.3
		}
	],
	figuren: [
		[-1, -3.8, 4],
		[3, -3.8, 4],
		[6, -8.45, 1],
		[-2, -7, 0],
		[10, -8, 0]
	],
	insel: { min: [-20, -12, -0.75], max: [20, 8, 0] },
	geplant: [{ rolle: 'huelle', min: [8.5, -3, 8], max: [13.5, 2, 11.5] }],
	auswahl: [
		{ a: [-5, -3.1, 4], b: [5, -3.1, 4] },
		{ a: [5, -3.1, 4], b: [5, -3.1, 7.7] },
		{ a: [5, -3.1, 7.7], b: [-5, -3.1, 7.7] },
		{ a: [-5, -3.1, 7.7], b: [-5, -3.1, 4] }
	],
	anker: [-5, -3.1, 4],
	gefahr: [{ a: [-3, -3.2, 5], b: [1, -3.2, 7] }],
	baustelle: [
		...[8, 11, 14].flatMap((x) =>
			[-4, 3].map(
				(y) =>
					[
						[x, y, 8],
						[x, y, 12]
					] as [number, number, number][]
			)
		),
		...[8, 10, 12].flatMap(
			(z) =>
				[
					[
						[8, -4, z],
						[14, -4, z],
						[14, 3, z],
						[8, 3, z],
						[8, -4, z]
					],
					[
						[8, -4, z],
						[11, -4, Math.min(z + 2, 12)],
						[14, -4, z]
					]
				] as [number, number, number][][]
		)
	]
} satisfies {
	bestand: { min: readonly [number, number, number]; max: readonly [number, number, number] }[];
	staebe: typeof staebe;
	koerper: {
		rolle: 'huelle' | 'raum' | 'kontext';
		teil?: 'boden' | 'rueckwand' | 'kern' | 'tuer' | 'nutzflaeche';
		strom?: 'people';
		min: [number, number, number];
		max: [number, number, number];
	}[];
	wege: { punkte: [number, number, number][]; breite: number }[];
	figuren: [number, number, number][];
	insel: { min: [number, number, number]; max: [number, number, number] };
	geplant: { rolle: 'huelle'; min: [number, number, number]; max: [number, number, number] }[];
	baustelle: [number, number, number][][];
	auswahl: { a: [number, number, number]; b: [number, number, number] }[];
	gefahr: { a: [number, number, number]; b: [number, number, number] }[];
	anker: [number, number, number];
};
