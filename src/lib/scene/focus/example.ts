import { offerFocus, readFocusLevel } from './index';

/** The choices a town with blocks and a lattice offers, and how Blocks draws its lattice. */
export function example() {
	return {
		offered: offerFocus(['terrain', 'water', 'detached', 'block', 'lattice']),
		latticeInBlocks: readFocusLevel('block', 'lattice')
	};
}
