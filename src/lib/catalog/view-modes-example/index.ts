import { landscapeChapter } from '../data/chapters';
import { resolveView, type ViewRequest } from '../logic/view-modes';

/** Resolves the landscape study's policy. Omitted IDs use its defaults. Returns a
 * frozen selection and throws RangeError for unavailable IDs. Neither input nor terrain changes.
 */
export function resolveExampleView(request?: ViewRequest) {
	return resolveView(landscapeChapter.steps[2], request);
}
