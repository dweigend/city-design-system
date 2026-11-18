import { random } from '../parametrik/random';

const zellweiteM = 0.035;
const tempoMproS = 1.1; // sqrt(g * mean hydraulic depth), linear shallow water.
const maxSegmente = 180;

function wellenzuege(saat: number) {
	const ziehen = random(saat);
	// Each train draws wavelength, heading, phase and lateral bend, in this order.
	return Array.from({ length: 11 }, (_, i) => ({
		k: (2 * Math.PI) / (0.15 + ziehen() * 0.31),
		winkel: (ziehen() - 0.5) * 0.95 + (i % 3 === 0 ? 1.1 : 0),
		phase: ziehen() * 2 * Math.PI,
		bogen: 1 + ziehen() * 2,
		// A few returning trains keep surface detail while the main field propagates down the tank.
		richtung: i % 3 === 1 ? -1 : 1,
		amplitudeM: 0.007 / Math.sqrt(i + 1)
	}));
}

function startFelder(
	nx: number,
	nz: number,
	dx: number,
	dz: number,
	schrittS: number,
	saat: number
) {
	const jetzt = new Float64Array(nx * nz);
	const zuvor = new Float64Array(nx * nz);
	for (const w of wellenzuege(saat)) {
		for (let z = 0; z < nz; z++) {
			const biegung = w.bogen * Math.sin(z * dz * 1.7 + w.phase);
			for (let x = 0; x < nx; x++) {
				const querM = x * dx;
				const laengsM = z * dz;
				const laufM = querM * Math.cos(w.winkel) + laengsM * Math.sin(w.winkel);
				// A varying current bends fronts and opens gaps in the reflected sky ridges.
				const drift = 1.15 * Math.sin(querM * 2.2 + laengsM * 1.4 + w.phase);
				const phase = w.k * laufM + w.phase + biegung + drift;
				const i = z * nx + x;
				const strom = Math.cos(querM * 1.8 - laengsM * 1.6 + w.phase);
				const amplitude = w.amplitudeM * (0.61 + 0.39 * strom);
				jetzt[i] += amplitude * Math.sin(phase);
				zuvor[i] += amplitude * Math.sin(phase + w.richtung * w.k * tempoMproS * schrittS);
			}
		}
	}
	// Remove net vertical velocity: the closed tank cannot gain or lose water.
	const summe = (h: Float64Array) => h.reduce((a, b) => a + b, 0);
	const versatz = (summe(jetzt) - summe(zuvor)) / jetzt.length;
	for (let i = 0; i < zuvor.length; i++) zuvor[i] += versatz;
	return [jetzt, zuvor] as const;
}

/**
 * Rectangular linear wave tank in metres. Positive finite spans required. The uint32 seed
 * defines the initial travelling trains. Heights are live row-major samples (x fastest).
 * One step advances the fixed CFL-limited interval, with reflecting walls and viscous damping.
 */
export function wasserFeld(breiteM: number, tiefeM: number, saat = 7241) {
	if (![breiteM, tiefeM].every((m) => Number.isFinite(m) && m >= zellweiteM))
		throw new RangeError('Wave tank spans must be finite and at least one cell wide.');
	const segmente = (m: number) => Math.min(maxSegmente, Math.ceil(m / zellweiteM));
	const nx = segmente(breiteM) + 1;
	const nz = segmente(tiefeM) + 1;
	const dx = breiteM / (nx - 1);
	const dz = tiefeM / (nz - 1);
	const schrittS = 0.65 / (tempoMproS * Math.hypot(1 / dx, 1 / dz));
	const cx = ((tempoMproS * schrittS) / dx) ** 2;
	const cz = ((tempoMproS * schrittS) / dz) ** 2;
	const reibung = Math.exp(-0.15 * schrittS);
	let [jetzt, zuvor] = startFelder(nx, nz, dx, dz, schrittS, saat);
	return {
		nx,
		nz,
		schrittS,
		get hoehenM() {
			return jetzt;
		},
		schritt() {
			for (let z = 0; z < nz; z++) {
				const oben = Math.max(0, z - 1) * nx;
				const unten = Math.min(nz - 1, z + 1) * nx;
				for (let x = 0; x < nx; x++) {
					const i = z * nx + x;
					const h = jetzt[i];
					// Repeat edge samples outside the box: zero flux at all four walls.
					const quer =
						jetzt[z * nx + Math.max(0, x - 1)] + jetzt[z * nx + Math.min(nx - 1, x + 1)] - 2 * h;
					const laengs = jetzt[oben + x] + jetzt[unten + x] - 2 * h;
					zuvor[i] = h + (h - zuvor[i]) * reibung + cx * quer + cz * laengs;
				}
			}
			[jetzt, zuvor] = [zuvor, jetzt];
		}
	};
}
