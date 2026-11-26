import { buildStoryScene } from './drawing';

try {
	self.postMessage({ ok: true, scene: buildStoryScene() });
} catch (error) {
	self.postMessage({
		ok: false,
		message: error instanceof Error ? error.message : 'Could not build the story valley'
	});
}
