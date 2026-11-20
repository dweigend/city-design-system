import type { FamilieId } from './materialSeite';

/** Studio finishes, independent of the legacy diagram recipe. First per family is native. */
export type AusfuehrungId =
	| 'metall-lackiert'
	| 'metall-gebuerstet'
	| 'metall-graphit'
	| 'metall-signalrot'
	| 'metall-kalkgruen'
	| 'keramik-glasiert'
	| 'keramik-ton'
	| 'keramik-orange-blau'
	| 'beton-schalung'
	| 'beton-terrazzo'
	| 'beton-geadert'
	| 'acryl-matt'
	| 'kunststoff-formteil'
	| 'kunststoff-guss'
	| 'glas-klar'
	| 'glas-matt'
	| 'holz-natur'
	| 'holz-gebeizt'
	| 'holz-aufrecht'
	| 'membran-beschichtet'
	| 'membran-gewebe'
	| 'membran-opal'
	| 'membran-voile'
	| 'membran-film'
	| 'wasser-ruhig'
	| 'bestand-matt'
	| 'metall-messing'
	| 'metall-kupfer'
	| 'keramik-schachbrett'
	| 'kunststoff-gerippt'
	| 'beton-schaum'
	| 'beton-spritzer'
	| 'kunststoff-marmoriert'
	| 'glas-photovoltaik'
	| 'membran-goldfolie'
	| 'perforated-metal'
	| 'pressed-chipboard'
	| 'clear-acrylic'
	| 'corrugated-metal'
	| 'planted-mat'
	| 'membran-flor';

export type Ausfuehrung = {
	id: AusfuehrungId;
	familie: FamilieId;
	name: string;
	beschreibung: string;
	grundton: string;
	pigment: number;
	rauheit: number;
	metall: number;
	transmission: number;
	deckkraft?: number;
};
