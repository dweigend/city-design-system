import {
	BLICK,
	DICHTE,
	MASSSTAB,
	MODUS_VERSCHIEBUNG,
	ROLLEN,
	STRICHE,
	SITUATION_VERSCHIEBUNG,
	WEG_STROM,
	ZOOM_BASIS,
	type Kontext,
	type Rolle
} from '../../data/leitstil';
import {
	focusModes,
	flowStepToken,
	type FlowId,
	type FlowStep,
	type LevelId
} from '../../data/focus';
export type RollenStil = {
	token: string;
	strom?: FlowId;
	stufe: FlowStep;
	strichPx: number;
	sichtbar: boolean;
	level: LevelId;
	kontrast: number;
	gestrichelt: boolean;
	schatten: boolean;
};
export type Stil = {
	rollen: Record<Rolle, RollenStil>;
	kamera: typeof BLICK & { pxProM: number; orthografisch: boolean; drehbar: boolean };
	signalZiele: string[];
	signalArt: 'linie' | 'flaeche';
	kernStufe: FlowStep;
	traegerRolle: 'traeger' | 'analyse';
	legende: boolean;
	analyseVeraltet: boolean;
	massstabsbalken: boolean;
	figurHoeheM: number;
	dichte: { neutralMin: number; kraeftigMax: number; figurenMax: number; labelsMax: number };
	fokus: FlowId[];
	fokusRaumStufe: FlowStep;
	thema: 'hell' | 'dunkel';
};
export function stilFuer(k: Kontext): Stil {
	const basis = ZOOM_BASIS[k.zoom];
	const rollen = Object.fromEntries(
		ROLLEN.map((rolle) => [
			rolle,
			{
				token: '--ink-2',
				stufe: 4,
				strichPx: STRICHE.detail,
				sichtbar: true,
				level: basis.level,
				kontrast: 3,
				gestrichelt: false,
				schatten: false
			}
		])
	) as Record<Rolle, RollenStil>;
	Object.assign(rollen.bestand, { token: 'bleistift', strichPx: STRICHE.bestand, kontrast: 1 });
	Object.assign(rollen.traeger, { token: '--ink', strichPx: STRICHE.minimumTraeger, kontrast: 6 });
	Object.assign(rollen.huelle, {
		token: 'modellweiss',
		strichPx: STRICHE.kontur,
		kontrast: 5,
		schatten: true
	});
	Object.assign(rollen.raum, {
		token: 'strom',
		strom: 'people',
		stufe: basis.raum,
		kontrast: 2,
		sichtbar: basis.innen
	});
	Object.assign(rollen.weg, {
		token: flowStepToken(WEG_STROM, 4),
		strom: WEG_STROM,
		stufe: basis.weg,
		kontrast: 2
	});
	Object.assign(rollen.gruen, { token: flowStepToken('food', 2), strom: 'food', stufe: 2 });
	Object.assign(rollen.figur, { token: '--ink', kontrast: 6 });
	Object.assign(rollen.auswahl, { token: '--signal', sichtbar: false, strichPx: 1.4 });
	Object.assign(rollen.geplant, {
		token: '--blueprint',
		gestrichelt: true,
		sichtbar: k.modus === 'bauen'
	});
	Object.assign(rollen.gefahr, {
		token: '--cat-hazard',
		gestrichelt: true,
		sichtbar: k.situation === 'stoerung'
	});
	Object.assign(rollen.analyse, {
		token: 'analyse',
		strichPx: 1.4,
		sichtbar: k.modus === 'analysieren'
	});
	const signal = MODUS_VERSCHIEBUNG[k.modus].signal;
	const s: Stil = {
		rollen,
		kamera: { ...BLICK, pxProM: MASSSTAB[k.zoom], orthografisch: true, drehbar: k.zoom === 'nah' },
		signalZiele: signal ? [signal] : [],
		signalArt: 'linie',
		kernStufe: 4,
		traegerRolle: 'traeger',
		legende: false,
		analyseVeraltet: false,
		massstabsbalken: true,
		figurHoeheM: 1.8,
		dichte: { ...DICHTE[k.zoom] },
		fokus: [],
		fokusRaumStufe: Math.min(4, basis.raum + 1) as FlowStep,
		thema: k.thema ?? 'hell'
	};
	rollen.auswahl.sichtbar = signal === 'auswahl';
	if (k.modus === 'bauen') {
		rollen.raum.stufe = 1;
		rollen.weg.stufe = 2;
		s.kernStufe = 1;
		s.dichte.figurenMax = Math.min(3, s.dichte.figurenMax);
		rollen.kontext.level = 'block';
	}
	const fokus = focusModes.find((m) => m.id === k.modus)?.flows ?? [];
	if (fokus.length) {
		s.fokus = [...fokus];
		rollen.raum.stufe = 1;
		rollen.raum.level = 'hull';
		rollen.weg.stufe = fokus.includes(WEG_STROM) ? (Math.min(4, basis.weg + 1) as FlowStep) : 1;
	}
	if (k.modus === 'bestand') {
		rollen.bestand.strichPx = 1.1;
		rollen.bestand.token = 'bleistift-fokus';
		rollen.raum.sichtbar = false;
		rollen.weg.sichtbar = false;
		rollen.gruen.sichtbar = false;
		rollen.huelle.level = 'hull';
	}
	if (k.modus === 'analysieren') {
		rollen.raum.sichtbar = false;
		s.traegerRolle = 'analyse';
		s.legende = true;
		s.dichte.figurenMax = Math.min(1, s.dichte.figurenMax);
		s.dichte.labelsMax = 7;
	}
	if (k.modus === 'erklaeren') {
		s.dichte.neutralMin -= 0.1;
		s.dichte.labelsMax = 8;
	}
	const delta = SITUATION_VERSCHIEBUNG[k.situation].raumDelta;
	rollen.raum.stufe = Math.max(1, rollen.raum.stufe + delta) as FlowStep;
	if (k.situation === 'stoerung') {
		rollen.kontext.level = 'block';
	}
	s.analyseVeraltet = k.situation === 'rechnen' && s.legende;
	return s;
}
/** Flow focus applies per interior volume, not across all rooms at once. */
export function raumStufe(s: Stil, strom: FlowId, kern = false): FlowStep {
	if (s.fokus.length) return s.fokus.includes(strom) ? s.fokusRaumStufe : 1;
	return kern ? s.kernStufe : s.rollen.raum.stufe;
}

/** Large interior floors stay light; the people floor sits below active path steps > 1.
 * Other uses keep their own flow color and step 2 at most.
 */
export function bodenStufe(s: Stil, strom: FlowId): FlowStep {
	const wegGrenze = strom === WEG_STROM ? Math.max(1, s.rollen.weg.stufe - 1) : 2;
	return Math.min(2, raumStufe(s, strom), wegGrenze) as FlowStep;
}
