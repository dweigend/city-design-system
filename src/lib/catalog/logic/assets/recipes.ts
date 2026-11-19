import { circulationObjects } from './circulation';
import { smallArchitecture } from './objects/small-architecture';
import { textiles } from './objects/textiles';
import { publicArt } from './objects/public-art';
import { recycling } from './objects/recycling';
import { fountains } from './objects/fountains';
import { wayfinding } from './objects/wayfinding';
import { cycleFurniture } from './objects/cycle-furniture';
import { recreation } from './objects/recreation';
import { shade } from './objects/shade';
import { marketStands } from './objects/market-stands';
import { display } from './objects/display';
import { vessels } from './objects/vessels';
import { lighting } from './objects/lighting';
import { tables } from './objects/tables';
import { seating } from './objects/seating';
import { walkwayStop } from './walkway-stop';
import { primitiveObjects } from './primitive-objects';
import { houseFittings } from './house-fittings';
import { roofMachinery } from './roof-machinery';
import { energyEquipment } from './energy-equipment';
import { exchangeStations } from './exchange-stations';
import { waterFeatures } from './water-features';
import { rainFittings } from './rain-fittings';
import { gardenBeds } from './garden-beds';
import { verticalGardens } from './vertical-gardens';
import { playgrounds } from './playgrounds';
import { streetSignals } from './street-signals';
import { plazaSeats } from './plaza-seats';
import { turnedWare } from './turned-ware';
import { sculpturalWare } from './sculptural-ware';
import { ceramicScreens } from './ceramic-screens';
import { walkways } from './walkways';
import { supports } from './supports';
import { platforms } from './platforms';
import { roofShells } from './roof-shells';
import { houseVolumes } from './house-volumes';
import { houseProjections } from './house-projections';
import type { AssetRecipe } from './definition';
import { porthole } from './porthole';
import { windowBand } from './window-band';
import { balcony } from './balcony';
import { bayWindow } from './bay-window';
import { louvres } from './louvres';
import { shippingContainer } from './shipping-container';
import { livingCapsule } from './living-capsule';
import { tankCapsule } from './tank-capsule';
import { dome } from './dome';
import { barrelVault } from './barrel-vault';
import { sawtooth } from './sawtooth';
import { solarRoof } from './solar-roof';
import { greenRoof } from './green-roof';
import { roofTerrace } from './roof-terrace';
import { glassBell } from './glass-bell';
import { observatory } from './observatory';
import { roundTree } from './round-tree';
import { columnTree } from './column-tree';
import { conifer } from './conifer';
import { umbrellaTree } from './umbrella-tree';
import { shrub } from './shrub';
import { treeTrough } from './tree-trough';
import { roofPlanting } from './roof-planting';
import { discSculpture } from './disc-sculpture';
import { ringSculpture } from './ring-sculpture';
import { facetedSculpture } from './faceted-sculpture';
import { twoSuns } from './two-suns';
import { memphis } from './memphis';
import { waterTower } from './water-tower';
import { tankFrame } from './tank-frame';
import { windmill } from './windmill';
import { chimney } from './chimney';
import { pipeRun } from './pipe-run';
import { stairs } from './stairs';
import { escalator } from './escalator';
import { ladder } from './ladder';
import { spiralStair } from './spiral-stair';
import { ceramicGlaze } from './ceramic-glaze';
import { terrazzo } from './terrazzo';
import { sheetMetal } from './sheet-metal';
import { corrugated } from './corrugated';
import { glass } from './glass';
import { planted } from './planted';

export const recipes: readonly AssetRecipe[] = [
	porthole,
	windowBand,
	balcony,
	bayWindow,
	louvres,
	shippingContainer,
	livingCapsule,
	tankCapsule,
	dome,
	barrelVault,
	sawtooth,
	solarRoof,
	greenRoof,
	roofTerrace,
	glassBell,
	observatory,
	roundTree,
	columnTree,
	conifer,
	umbrellaTree,
	shrub,
	treeTrough,
	roofPlanting,
	discSculpture,
	ringSculpture,
	facetedSculpture,
	twoSuns,
	memphis,
	waterTower,
	tankFrame,
	windmill,
	chimney,
	pipeRun,
	stairs,
	escalator,
	ladder,
	spiralStair,
	ceramicGlaze,
	terrazzo,
	sheetMetal,
	corrugated,
	glass,
	planted,
	...houseVolumes,
	...houseProjections,
	...roofShells,
	...supports,
	...platforms,
	...walkways,
	...turnedWare,
	...sculpturalWare,
	...ceramicScreens,
	...streetSignals,
	...plazaSeats,
	...playgrounds,
	...gardenBeds,
	...verticalGardens,
	...waterFeatures,
	...rainFittings,
	...energyEquipment,
	...exchangeStations,
	...houseFittings,
	...roofMachinery,
	walkwayStop,
	...circulationObjects,
	...primitiveObjects,
	...seating,
	...tables,
	...lighting,
	...vessels,
	...display,
	...marketStands,
	...shade,
	...recreation,
	...cycleFurniture,
	...wayfinding,
	...fountains,
	...recycling,
	...publicArt,
	...textiles,
	...smallArchitecture
];
