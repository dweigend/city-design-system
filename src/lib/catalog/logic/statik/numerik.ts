/**
 * Shared numerics of the structural core: a symmetric positive definite system in envelope
 * (skyline) storage with an explicit failure instead of a silent repair. Headless and
 * deterministic; no physics. Trusses use it today, beams and force-density nets can share it.
 */

/** Dimensionless pivot limit after Jacobi scaling (diagonal = 1). Below it the row is singular. */
export const PIVOT_GRENZE = 1e-10;

export type Huellmatrix = {
	n: number;
	/** First stored column of each row; entries left of it are structurally zero. */
	start: Int32Array;
	/** Lower triangle by rows, `zeilen[i][j - start[i]]` for `start[i] ≤ j ≤ i`. */
	zeilen: Float64Array[];
};
export type Zerlegung =
	{ ok: true; loese(rechteSeite: Float64Array): Float64Array } | { ok: false; zeile: number };

/** Empty matrix for a known coupling profile. `start[i] ≤ i`. */
export function huellmatrix(start: Int32Array): Huellmatrix {
	const zeilen = Array.from(start, (s, i) => new Float64Array(i - s + 1));
	return { n: start.length, start, zeilen };
}

/** Adds `wert` to the symmetric entry (i, j). The profile must contain the pair. */
export function addiere(m: Huellmatrix, i: number, j: number, wert: number) {
	const zeile = Math.max(i, j),
		spalte = Math.min(i, j);
	m.zeilen[zeile][spalte - m.start[zeile]] += wert;
}

/**
 * Cholesky factorization K = L·Lᵀ of the Jacobi-scaled matrix. The input is not mutated; the
 * result owns its factor. A non-positive diagonal or a scaled pivot at or below `PIVOT_GRENZE`
 * returns the failing row: for a stiffness matrix that row belongs to a mechanism.
 */
export function zerlege(m: Huellmatrix): Zerlegung {
	const { n, start } = m;
	const skala = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const diagonale = m.zeilen[i][i - start[i]];
		if (!(diagonale > 0) || !Number.isFinite(diagonale)) return { ok: false, zeile: i };
		skala[i] = 1 / Math.sqrt(diagonale);
	}
	const faktor = m.zeilen.map((zeile) => Float64Array.from(zeile));
	for (let i = 0; i < n; i++) {
		const li = faktor[i],
			si = start[i];
		for (let j = si; j <= i; j++) {
			const lj = faktor[j],
				sj = start[j];
			let summe = li[j - si] * skala[i] * skala[j];
			for (let k = Math.max(si, sj); k < j; k++) summe -= li[k - si] * lj[k - sj];
			if (j < i) li[j - si] = summe / lj[j - sj];
			else if (summe > PIVOT_GRENZE) li[j - si] = Math.sqrt(summe);
			else return { ok: false, zeile: i };
		}
	}
	return {
		ok: true,
		loese(rechteSeite) {
			const x = Float64Array.from(rechteSeite, (v, i) => v * skala[i]);
			for (let i = 0; i < n; i++) {
				const li = faktor[i],
					si = start[i];
				let summe = x[i];
				for (let k = si; k < i; k++) summe -= li[k - si] * x[k];
				x[i] = summe / li[i - si];
			}
			for (let i = n - 1; i >= 0; i--) {
				const li = faktor[i],
					si = start[i];
				x[i] /= li[i - si];
				for (let k = si; k < i; k++) x[k] -= li[k - si] * x[i];
			}
			for (let i = 0; i < n; i++) x[i] *= skala[i];
			return x;
		}
	};
}
