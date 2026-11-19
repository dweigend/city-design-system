import { sheetMetal } from '../sheet-metal';
import type { AssetSurface } from '../definition';
export const suggestions = {
	frame: sheetMetal.finishes.brushed,
	body: { material: 'glaze', finish: 'keramik-glasiert', token: '--body-living' },
	shell: { material: 'metal', finish: 'metall-kalkgruen', token: '--cat-nature-2' },
	slats: { material: 'wood', finish: 'holz-natur', token: '--cat-living' },
	foot: { material: 'concrete', finish: 'beton-terrazzo', token: '--paper' },
	fabric: { material: 'membrane', finish: 'membran-gewebe', token: '--paper' },
	liquid: { material: 'water', finish: 'wasser-ruhig', token: '--cat-health' },
	diffuser: { material: 'glass', finish: 'glas-matt', token: '--cat-mobility' },
	screen: { material: 'glass', finish: 'glas-klar', token: '--cat-nature-2' }
} satisfies Record<string, AssetSurface>;
