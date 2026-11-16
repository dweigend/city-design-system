/** Classification of original adaptations and their design references. */
export type Uebertragung = {
	/** Name, work and year, where known; otherwise empty. */
	vorbild: string;
	/** Message and target page from curation. */
	zweck: string;
	zentrum: 'Technik' | 'Stil' | 'Prinzip' | 'UI-Layout';
};
