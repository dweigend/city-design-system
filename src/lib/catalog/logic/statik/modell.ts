/**
 * Data of the structural core, shared by every physical model. World frame: x/y ground plane,
 * z up; meters, newtons, pascals. Tension is positive. IDs are stable and carry identity; array
 * order never decides a result.
 */
export type Vec3 = [number, number, number];
export type Knoten = { id: string; p: Vec3 };
/**
 * Translational restraint per world axis. `true` holds the node, `false` lets it slide.
 * `nurDruck`: a shoe that rests on its base; it may press down but never pull up (`abtragen`).
 */
export type Lager = { knotenId: string; fest: [boolean, boolean, boolean]; nurDruck?: boolean };
export type Last = { knotenId: string; kraftN: Vec3 };
export type Lastfall = {
	id: string;
	lasten: Last[];
	/**
	 * Self weight as a body force in multiples of g, e.g. `[0, 0, -1.35]`. A horizontal part
	 * models the sway imperfection. Only evaluated where member sizes are known (`abtragen`).
	 */
	eigengewichtG?: Vec3;
};
export type Werkstoff = { eModulPa: number; grenzspannungPa: number; dichteKgM3: number };
/** Demo values of structural steel S235; no code check (docs/research/06-structural-demo.md, appendix C). */
export const STAHL: Werkstoff = { eModulPa: 210e9, grenzspannungPa: 235e6, dichteKgM3: 7850 };
export const ERDBESCHLEUNIGUNG_M_S2 = 9.81;
/** Explicit failures. None of them yields a seemingly valid structure. */
export type Fehlerstatus =
	| 'eingabe-ungueltig'
	| 'lager-hebt-ab'
	| 'lastpfad-fehlt'
	| 'mechanismus'
	| 'nicht-bemessbar'
	| 'zugstab-unter-druck';
export type Fehlschlag = { status: Fehlerstatus; elementId: string };
