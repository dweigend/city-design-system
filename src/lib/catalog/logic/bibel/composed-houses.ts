import { planHouse, sectionParts, houseLinks, paintedSections } from '../composed-house';
import type { HouseUse } from '../house-brush';
import { squareGrid } from '../quad-grid';
import type { RulePlate } from './hausregel';

const mixed: HouseUse[] = ['water','living','food','energy'];
function single(id:string,title:string,text:string,uses:HouseUse[],seed:number,bank=false):RulePlate {
	const cell=squareGrid(1,1,19).cells[0];
	const house=planHouse({cells:[cell],stacks:new Map([[cell.id,uses]]),district:bank?'bank':'infill',seed});
	return {id,title,text,primitives:sectionParts(house)};
}
function ensemble():RulePlate {
	const grid=squareGrid(3,1,10);
	const stacks=new Map(grid.cells.map((c,i)=>[c.id,mixed.slice(0,i+2)]));
	const houses=paintedSections(grid,stacks,0);
	return {id:'ensemble',title:'Three neighbours',text:'Bridges connect the occupied decks at their shared two-metre datum.',
	primitives:[...houses.flatMap(h=>sectionParts(h)),...houseLinks(grid,houses,0).flatMap(b=>b.parts)]};
}
/** Four reproducible single-house typologies and one connected painted ensemble. */
export function composedHousePlates():RulePlate[] {
	return [
		single('pavilion','Capsule stack','Four inhabited levels carry glazed capsules in cradles.',Array<HouseUse>(4).fill('living'),1),
		single('house','Deck tower','Water, housing, planting and energy share a frame of articulated columns.',mixed,3),
		single('round','Round tower','Circular decks carry drums above the waterfront.',Array<HouseUse>(8).fill('water'),0,true),
		single('rectangular','Cluster mast','Capsules turn around a shared mast on successive levels.',Array<HouseUse>(5).fill('living'),1),
		ensemble()
	];
}
