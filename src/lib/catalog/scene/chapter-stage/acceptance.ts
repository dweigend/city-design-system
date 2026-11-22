import { acceptanceScene } from '../../logic/sandbox';
import { createSandboxStage } from '../sandbox';
import type { ChapterStageFactory } from './types';

/** Opens the existing acceptance town with its fixed study frame on the chapter canvas. */
export const createAcceptanceChapterStage: ChapterStageFactory = (canvas, onError, seed) => {
	const { world, earliestFullYear, additions, frame, portraitFrame } = acceptanceScene(seed);
	const stage = createSandboxStage(canvas, onError, {
		earliestFullYear,
		additions,
		frame,
		portraitFrame
	});
	void stage.ready.catch(() => {});
	stage.setTransitPaused(true);

	return {
		show: () => stage.show(world, 'all'),
		reveal: () => {},
		setView: stage.setView,
		resize: stage.resize,
		dispose: stage.dispose
	};
};
