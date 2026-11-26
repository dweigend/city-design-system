import {
	advanceCityGrowth,
	readCitySnapshot,
	type CityGrowthRun
} from '../../lib/world/city-growth';
import { createStoryDrawing } from './drawing';
import { foundStory, milestones, readStoryHandover, scheduleStoryStock } from './growth';
import {
	createStoryEncoder,
	type StoryFrame,
	type StoryReply,
	type StoryRequest
} from './timeline';

const eventsPerBatch = 12;

function stream({ requestId, setup }: StoryRequest) {
	const story = foundStory(setup);
	const { site, run: initial, adoptedId } = story;
	const drawing = createStoryDrawing(site, initial, adoptedId);
	const encode = createStoryEncoder();
	let sent = 0;
	let pending: StoryFrame[] = [];

	function send(
		payload: Pick<
			Partial<Extract<StoryReply, { kind: 'batch' }>>,
			'checkpoint' | 'fit' | 'handover'
		> = {}
	) {
		const reply: StoryReply = {
			requestId,
			kind: 'batch',
			...encode(drawing.drain()),
			events: pending,
			...payload
		};
		self.postMessage(reply);
		pending = [];
	}

	function projectEvents(run: CityGrowthRun) {
		while (sent < run.events.length) {
			pending.push(drawing.draw(readCitySnapshot(run, { kind: 'event', index: sent++ })));
			if (pending.length === eventsPerBatch) send();
		}
	}

	// Publish the settled founding checkpoint before advancing the simulation.
	const initialSnapshot = readCitySnapshot(initial);
	const first = drawing.draw(initialSnapshot);
	projectEvents(initial);
	send({ checkpoint: first, fit: drawing.fitSettled(initialSnapshot) });

	let run = scheduleStoryStock(story, setup.preset);
	for (const { year } of milestones.slice(1)) {
		run = advanceCityGrowth(run, year);
		projectEvents(run);
		const snapshot = readCitySnapshot(run);
		const checkpoint = drawing.draw(snapshot);
		send({
			checkpoint,
			...(year === milestones[milestones.length - 1].year && { fit: drawing.fitSettled(snapshot) })
		});
	}
	send({ handover: readStoryHandover(run, adoptedId) });
}

self.onmessage = ({ data }: MessageEvent<StoryRequest>) => {
	try {
		stream(data);
	} catch {
		const reply: StoryReply = { requestId: data.requestId, kind: 'error' };
		self.postMessage(reply);
	}
};
