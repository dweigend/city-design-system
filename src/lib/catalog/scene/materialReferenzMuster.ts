import type { Node } from 'three/webgpu';
import type { AusfuehrungId } from '../data/materialAusfuehrung';
import {
	goldfolieMuster,
	harzMuster,
	kupferMuster,
	messingMuster,
	rippenMuster
} from './materialBeschichtungMuster';
import type { Muster } from './materialMuster';
import { schachbrettMuster, solarMuster } from './materialRasterMuster';
import {
	plantedMatPattern,
	florMuster,
	schaumMuster,
	spritzerMuster
} from './materialZuschlagMuster';

const musterVon: Partial<
	Record<AusfuehrungId, (base: Node<'vec3'>, welt: Node<'vec3'>) => Muster>
> = {
	'corrugated-metal': rippenMuster,
	'planted-mat': plantedMatPattern,
	'metall-messing': messingMuster,
	'metall-kupfer': kupferMuster,
	'keramik-schachbrett': schachbrettMuster,
	'kunststoff-gerippt': rippenMuster,
	'beton-schaum': schaumMuster,
	'beton-spritzer': spritzerMuster,
	'kunststoff-marmoriert': harzMuster,
	'glas-photovoltaik': solarMuster,
	'membran-goldfolie': goldfolieMuster,
	'membran-flor': florMuster
};

/** Selects the extra reference pattern. An earlier finish falls through to its family shader. */
export function referenzMuster(
	id: AusfuehrungId,
	base: Node<'vec3'>,
	welt: Node<'vec3'>
): Muster | undefined {
	return musterVon[id]?.(base, welt);
}
