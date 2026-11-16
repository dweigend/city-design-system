import { BLICK, MASSSTAB, ROLLEN, WEG_STROM, type Kontext } from '../../data/leitstil';
import { flowStepToken } from '../../data/focus';
import { stilFuer, type Stil } from './kontext';
import type { LeitstilSzene } from './szene';
export type Verstoss = { id: string; satz: string };
export function pruefeStil(s: Stil, k: Kontext): Verstoss[] {
	const v: Verstoss[] = [];
	const add = (id: string, satz: string) => v.push({ id, satz });
	const r = s.rollen;
	if (r.huelle.strom || r.huelle.token !== 'modellweiss')
		add('INV-04', 'The outer envelope must stay model white.');
	if (
		s.signalZiele.length > 1 ||
		s.signalArt !== 'linie' ||
		s.signalZiele.some((z) => z !== 'auswahl' && z !== 'baustelle')
	)
		add('INV-08', 'Signal may mark exactly one action target, as a line.');
	if (ROLLEN.some((id) => id !== 'traeger' && r[id].strichPx >= 1.5) || r.traeger.strichPx < 1.5)
		add('INV-03', 'Stroke band violated.');
	if (
		Object.keys(r).length !== ROLLEN.length ||
		r.weg.strom !== WEG_STROM ||
		r.weg.token !== flowStepToken(WEG_STROM, 4)
	)
		add('INV-01', 'Roles and their color families stay fixed.');
	if (ROLLEN.some((id) => r[id].kontrast > r.traeger.kontrast))
		add('INV-02', 'The structure must keep the strongest contrast.');
	if (
		r.bestand.schatten ||
		r.bestand.strom ||
		!['bleistift', 'bleistift-fokus'].includes(r.bestand.token)
	)
		add('INV-05', 'Existing stock stays paper and pencil.');
	if (
		!s.kamera.orthografisch ||
		s.kamera.azimutRad !== BLICK.azimutRad ||
		s.kamera.hoeheRad !== BLICK.hoeheRad ||
		s.kamera.pxProM !== MASSSTAB[k.zoom]
	)
		add('INV-06', 'Projection and scale are fixed.');
	if (!s.massstabsbalken || s.figurHoeheM !== 1.8 || r.figur.token !== '--ink')
		add('INV-07', 'Scale requires a 1.8 m figure or a bar.');
	if (!(
		r.traeger.kontrast > r.huelle.kontrast &&
		r.huelle.kontrast > r.raum.kontrast &&
		r.raum.kontrast > r.bestand.kontrast &&
		r.bestand.kontrast > 0
	))
		add('INV-09', 'Contrast order violated.');
	if (JSON.stringify(s) !== JSON.stringify(stilFuer(k)))
		add('INV-10', 'Style deviates from the pure context function.');
	// E5 reports only the three original contract violations, no follow-on deviation.
	return v.some((x) => x.id !== 'INV-10') ? v.filter((x) => x.id !== 'INV-10') : v;
}
export function pruefeSzene(szene: LeitstilSzene, s: Stil): Verstoss[] {
	const v: Verstoss[] = [];
	for (const k of szene.koerper) {
		if (k.rolle === 'huelle' && k.strom)
			v.push({ id: 'INV-04', satz: 'Outer volume with flow color.' });
		if (k.rolle === 'raum' && !k.teil)
			v.push({ id: 'INV-04', satz: 'Interior color needs a named usable area.' });
	}
	if (!s.massstabsbalken && (szene.figuren.length === 0 || s.kamera.pxProM * 1.8 < 12))
		v.push({ id: 'INV-07', satz: 'Scale missing.' });
	return v;
}
