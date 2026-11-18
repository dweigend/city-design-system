import { studienZufall } from './studienZufall';

// Work in meters on a periodic perimeter grid. Row zero is the roof edge.
const SPALTEN = 128;
const ZEILEN = 40;
const SCHRITTE = 76;

function einspeisung(u: number, saat: number): number {
	let tiefe = 0.036;
	for (let i = 0; i < 8; i++) {
		const d = Math.abs(u - studienZufall(saat, i));
		const weit = Math.min(d, 1 - d);
		const radius = 0.013 + studienZufall(saat, i + 16) * 0.019;
		const faktor = Math.max(0, 1 - weit / radius);
		tiefe += faktor * faktor * (0.06 + studienZufall(saat, i + 32) * 0.09);
	}
	return tiefe;
}

function anfangen(saat: number): Float64Array {
	const a = new Float64Array(SPALTEN * ZEILEN);
	for (let u = 0; u < SPALTEN; u++) {
		const tiefe = einspeisung(u / SPALTEN, saat);
		a[u] = 1.3 * tiefe;
		a[SPALTEN + u] = tiefe;
		a[2 * SPALTEN + u] = 0.75 * tiefe;
		a[3 * SPALTEN + u] = 0.44 * tiefe;
	}
	return a;
}

/** Explicit conservative gradient step with a damped contact line and periodic lateral flux. */
function fluss(a: Float64Array): Float64Array {
	const b = new Float64Array(a);
	for (let zeile = 0; zeile < ZEILEN - 1; zeile++)
		for (let u = 0; u < SPALTEN; u++) {
			const i = zeile * SPALTEN + u;
			if (a[i] < 0.001) continue;
			const unter = i + SPALTEN;
			const rechts = zeile * SPALTEN + ((u + 1) % SPALTEN);
			const menge = Math.min(a[i] * 0.36, a[i] ** 2 * 7.6);
			const seitlich = (a[i] - a[rechts]) * 0.034;
			b[i] -= menge + seitlich;
			b[unter] += menge;
			b[rechts] += seitlich;
		}
	return b;
}

function nasskante(a: Float64Array): Float64Array {
	const v = new Float64Array(SPALTEN);
	for (let u = 0; u < SPALTEN; u++)
		for (let zeile = 1; zeile < ZEILEN; zeile++)
			if (a[zeile * SPALTEN + u] >= 0.005) v[u] = zeile / (ZEILEN - 1);
	return v;
}

/**
 * Simulate a viscous downhill film from seeded roof spills. The result is detached:
 * coating thickness in meters, row-major from roof to base, and normalized wet front per column.
 * Periodic columns, closed bottom and explicit deterministic steps, clamped to [0, 120].
 */
export function lackfilm(saat: number, schritte = SCHRITTE) {
	const anzahl = Math.max(0, Math.min(120, Math.floor(schritte)));
	let tiefeM = anfangen(saat >>> 0);
	for (let i = 0; i < anzahl; i++) tiefeM = fluss(tiefeM);
	return { spalten: SPALTEN, zeilen: ZEILEN, tiefeM, front: nasskante(tiefeM) };
}
