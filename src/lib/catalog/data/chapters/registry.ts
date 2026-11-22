import { architectureChapter } from './architecture';
import { assetsChapter } from './assets';
import { cityChapter } from './city';
import { contentChapter } from './content';
import { interfaceChapter } from './interface';
import { landscapeChapter } from './landscape';
import { storyChapter } from './story';
import { supplyChapter } from './supply';
import { surfacesChapter } from './surfaces';
import { transportChapter } from './transport';
import type { Chapter } from './types';

/** The bible in reading order, shared by routing and navigation. */
export const chapters = [
	landscapeChapter,
	cityChapter,
	transportChapter,
	supplyChapter,
	architectureChapter,
	surfacesChapter,
	interfaceChapter,
	assetsChapter,
	contentChapter,
	storyChapter
] as const satisfies readonly Chapter[];

export type ChapterSlug = (typeof chapters)[number]['slug'];
