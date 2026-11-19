import { previewStrokePlan } from '../logic/sandbox';
import type { StrokeRelease } from './feedback';
import type { Session } from './session.svelte';

type FrameHooks = {
	frame: (run: () => void) => void;
	acknowledge: () => void;
	preview: (marks: ReturnType<typeof previewStrokePlan>) => void;
	finish: () => void;
};

/** Shows the final survey before committing, or settles the release if either frame fails. */
export function scheduleStrokeRelease(
	session: Pick<Session, 'surveyRelease' | 'commitRelease' | 'rejectRelease'>,
	release: StrokeRelease,
	hooks: FrameHooks
) {
	const reject = (error: unknown) => session.rejectRelease(release, error, hooks.finish);
	const guarded = (run: () => void) => {
		try {
			run();
		} catch (error) {
			reject(error);
		}
	};
	const frame = (run: () => void) => guarded(() => hooks.frame(() => guarded(run)));

	frame(() => {
		hooks.acknowledge();
		const plan = session.surveyRelease(release);
		if (!plan) return;
		hooks.preview(previewStrokePlan(plan));
		frame(() => session.commitRelease(release, hooks.finish));
	});
}
