import { sandboxMotion, sandboxScale, sandboxSounds } from '../data/sandbox';
import type { Completion } from './feedback';

type Cue = keyof typeof sandboxSounds;
type Note = { cue: Cue; atMs: number; level?: number };
const NOTES_PER_SECOND = 12;

function storyLevel(world: Completion['after'], id: string) {
	return (world.state.stacks.get(id)?.length ?? 0) - 1;
}

function houseNotes({ kind, before, after, cellIds }: Completion): Note[] {
	const notes = cellIds.flatMap((id, i): Note[] => {
		const level = storyLevel(after, id);
		if (level === storyLevel(before, id)) return [];
		return [
			{
				cue: kind === 'erase' ? 'erase' : 'ceramic',
				level: Math.max(0, level),
				atMs: Math.min(i * 24, sandboxMotion.seatMs)
			}
		];
	});
	if (notes.length) return notes;
	if (kind === 'erase') return [{ cue: 'erase', atMs: 0 }];
	const carrier = [...after.state.parts.values()].some(
		(part) => part.recipe === 'chord' && !before.state.parts.has(part.id)
	);
	return [{ cue: carrier ? 'carrier' : 'ceramic', atMs: 0 }];
}

function railNotes({ before, after }: Completion): Note[] {
	const lines = after.lines.filter((line) => !before.lines.includes(line));
	const { seatMs, pillarStepMs, responseMs } = sandboxMotion;
	if (!lines.length) return [{ cue: 'pillar', atMs: 0 }];
	return lines.flatMap(({ pillars, stops }) => [
		...pillars.map((_, i): Note => ({
			cue: 'pillar',
			atMs: Math.min(i * pillarStepMs, responseMs - seatMs)
		})),
		...stops.map((): Note => ({ cue: 'stop', atMs: responseMs - seatMs }))
	]);
}

const notesByTool: Record<Completion['kind'], (completion: Completion) => Note[]> = {
	house: houseNotes,
	erase: houseNotes,
	line: railNotes,
	dig: () => [
		{ cue: 'dig', atMs: 0 },
		{ cue: 'water', atMs: sandboxMotion.seatMs }
	],
	cover: () => [{ cue: 'growth', atMs: 0 }],
	advance: () => [{ cue: 'advance', atMs: 0 }],
	look: () => []
};

function noiseSource(context: AudioContext, lengthS: number, hz: number) {
	const buffer = context.createBuffer(
		1,
		Math.ceil(context.sampleRate * lengthS),
		context.sampleRate
	);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	const source = context.createBufferSource();
	source.buffer = buffer;
	const filter = context.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = hz;
	source.connect(filter);
	return { source, output: filter };
}

function voice(context: AudioContext, note: Note) {
	const sound = sandboxSounds[note.cue];
	const steps = sandboxScale[note.level ?? 0] ?? sandboxScale[sandboxScale.length - 1];
	const hz = sound.hz * 2 ** (steps / 12);
	if (sound.wave === 'noise') return noiseSource(context, sound.seconds, hz);
	const source = context.createOscillator();
	source.type = sound.wave;
	source.frequency.value = hz;
	return { source, output: source };
}

/** Owns one quiet Web Audio output, unlocked by an explicit player gesture. */
export function createSandboxSound() {
	let audio: ReturnType<typeof output> | undefined;
	let starts: number[] = [];
	let muted = false;
	const audible = () => !muted && !document.hidden;

	function output() {
		const context = new AudioContext();
		const master = context.createGain();
		master.connect(context.destination);
		return { context, master };
	}

	function unlock() {
		if (muted || typeof AudioContext === 'undefined') return;
		audio ??= output();
		void audio.context.resume().catch(() => {});
	}

	function playNote({ context: ctx, master }: ReturnType<typeof output>, note: Note, at: number) {
		const sound = sandboxSounds[note.cue];
		const { source, output } = voice(ctx, note);
		const gain = ctx.createGain();
		const end = at + sound.seconds;
		const peak = 'reverse' in sound ? end - 0.016 : at + 0.008;
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(sound.gain, peak);
		gain.gain.exponentialRampToValueAtTime(0.0001, end);
		output.connect(gain).connect(master);
		source.start(at);
		source.stop(end);
		source.onended = () => {
			source.disconnect();
			output.disconnect();
			gain.disconnect();
		};
	}

	function schedule(requested: Note[]) {
		if (!audio || !audible()) return;
		const now = audio.context.currentTime;
		starts = starts.filter((start) => start > now - 1);
		for (const note of requested.slice(0, NOTES_PER_SECOND - starts.length)) {
			const at = now + note.atMs / 1000;
			starts.push(at);
			playNote(audio, note, at);
		}
	}

	return {
		unlock,
		/** Schedules cues from a committed edit with a rolling twelve-voice limit. */
		play(this: void, completion: Completion) {
			schedule(notesByTool[completion.kind](completion));
		},
		/** Mutes immediately, including already scheduled notes. */
		setMuted(next: boolean) {
			muted = next;
			if (audio) audio.master.gain.value = Number(!muted);
			if (!muted) unlock();
		},
		/** Releases the session's audio context. */
		dispose(this: void) {
			void audio?.context.close().catch(() => {});
		}
	};
}
