<script lang="ts">
	import { onMount } from 'svelte';
	import { Random } from '../../lib/core/random';
	import type { Parcel } from '../../lib/domain/parcels';
	import {
		readPlacementId,
		type createSandboxDocument,
		type PlacementChange,
		type SandboxEdit,
		type SandboxPlacement
	} from '../../lib/domain/sandbox-document';
	import { blockTriangleBudget } from '../../lib/scene/house-projection';
	import {
		createBuildQueue,
		createStrokeDraft,
		createStrokeState,
		readPreviewHeight,
		selectHouseDetail,
		shareBlockBudget,
		showIntervalMs,
		type StrokeEffect
	} from '../../lib/scene/sandbox-interaction';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import { StageView, type GroundPointer } from '../../lib/scene/stage-view';
	import type { Drawable } from '../../lib/scene/surface';
	import { FilePicker } from '../../lib/ui/file-picker';
	import { IconButton } from '../../lib/ui/icon-button';
	import { Slider } from '../../lib/ui/slider';
	import { SpecimenPicker } from '../../lib/ui/specimen-picker';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { ToolBar } from '../../lib/ui/tool-bar';
	import { UnavailableHostError } from '../../lib/world/sandbox-world';
	import { createStrokePointer } from './stroke';
	import { createTownSandbox, type Detail, type PlacementRequest } from './town';

	type Town = ReturnType<typeof createTownSandbox>;
	type Tool = 'paint' | 'erase' | 'reseed' | 'select';
	type Tally = { placed: number; removed: number; reseeded: number; occupied: number; off: number };

	const styleNames: Readonly<Record<string, string>> = {
		'house/court-neutral': 'Neutral',
		'house/court-memphis': 'Memphis',
		'house/court-archigram': 'Archigram',
		'house/court-organic': 'Organic',
		'park/grove': 'Grove'
	};
	const reasons: Readonly<Record<string, string>> = {
		'no-common-bay': 'too narrow',
		'no-frontage-route': 'no way in from the lane',
		'no-built-cells': 'too small',
		'entrance-below-lane': 'too steep'
	};
	const tools = [
		{ value: 'paint', label: 'Paint', icon: 'paintbrush', shortcut: 'B' },
		{ value: 'erase', label: 'Erase', icon: 'eraser', shortcut: 'E' },
		{ value: 'reseed', label: 'Reseed', icon: 'dices', shortcut: 'R' },
		{ value: 'select', label: 'Select', icon: 'pointer', shortcut: 'V' }
	] as const;
	const toolKeys = new Map<string, Tool>(tools.map(({ value, shortcut }) => [shortcut, value]));
	const hints: Readonly<Record<Tool, string>> = {
		paint: 'Drag to paint',
		erase: 'Drag to erase',
		reseed: 'Drag to reseed',
		select: 'Click a placement to edit it'
	};
	const views = [
		{ value: 'iso', label: '3D' },
		{ value: 'plan', label: 'Plan' }
	];
	const address = (id: string) => ({ kind: 'parcel', id }) as const;
	const plural = (count: number, one: string, many = one + 's') =>
		`${count} ${count === 1 ? one : many}`;

	let town = $state.raw<Town>();
	let layout = $state.raw<Town['projection']['background']>([]);
	let specimens = $state.raw<{ value: string; label: string; sketch: Sketch }[]>([]);
	let documentModel: ReturnType<typeof createSandboxDocument>;
	let cache: ReturnType<Town['createCache']>;
	let pointer: ReturnType<typeof createStrokePointer>;
	const stroke = createStrokeState<Parcel>();
	const queue = createBuildQueue<readonly Drawable[]>(() => performance.now());
	const serials = new WeakMap<PlacementRequest, number>();
	let serial = 0;
	let requests = new Map<string, PlacementRequest>();
	const bodies = new WeakMap<PlacementRequest, Drawable>();

	let history = $state({ placements: 0, strokes: 0, position: 0 });
	let placed = $state.raw<readonly Drawable[]>([]);
	let marks = $state.raw<readonly Drawable[]>([]);
	let hovered = $state.raw<Parcel>();
	let selectedId = $state<string>();
	let selected = $state.raw<SandboxPlacement>();
	let waiting = $state(0);
	let view = $state<View>('iso');
	let tool = $state<Tool>('paint');
	let style = $state('house/court-neutral');
	let status = $state('');
	let loading = $state(false);
	let panning = $state(false);
	let frameWork = $state.raw<{ run: () => boolean }>();

	type Sketch = ReturnType<Town['createSpecimens']> extends Map<string, infer S> ? S : never;
	type Draft = {
		tool: string;
		drawing: ReturnType<typeof createStrokeDraft<SandboxEdit, Drawable>>;
		tally: Tally;
		skipped: Map<string, Parcel>;
	};
	let open: Draft | undefined;
	let press: { x: number; y: number } | undefined;

	const fit = $derived(
		town && { fill: town.viewContextFill, subject: projectFocus(view, {}, town.points) }
	);
	const hoverMark = $derived(town && hovered && town.projection.projectHover(hovered));
	const drawables = $derived([...layout, ...placed, ...marks, ...(hoverMark ? [hoverMark] : [])]);
	const hoveredRequest = $derived(hovered && readRequest(hovered.id));
	const hint = $derived(describeHover(hovered, hoveredRequest) ?? hints[tool]);
	const asset = $derived(selected && town?.assets.find(({ id }) => id === selected?.assetId));

	onMount(() => {
		try {
			const opened = createTownSandbox();
			documentModel = opened.world.createDocument();
			cache = opened.createCache(documentModel);
			pointer = createStrokePointer(opened.world.polygons, opened.projection.toWorld);
			layout = opened.projection.background;
			specimens = [...opened.createSpecimens()].map(([value, sketch]) => ({
				value,
				label: styleNames[value] ?? value,
				sketch
			}));
			town = opened;
		} catch (error) {
			fail(error);
		}
	});

	function fail(error: unknown) {
		status = error instanceof Error ? error.message : 'Could not update the sandbox.';
	}

	function readRequest(parcelId: string) {
		const placement = documentModel?.readPlacement(address(parcelId));
		return placement && requests.get(placement.id);
	}

	function describeHover(parcel: Parcel | undefined, request: PlacementRequest | undefined) {
		if (!parcel) return undefined;
		if (parcel.publicUse) return 'Public ground: streets and squares stay open';
		if (request?.reason) return `Kept as garden: ${reasons[request.reason] ?? request.reason}`;
		if (request && tool === 'select') return styleNames[request.placement.assetId];
		return undefined;
	}

	/** The detail each house is drawn at now, with its share of the block budget. */
	function readDetails() {
		const pointed = tool === 'select' ? hoveredRequest?.placement.id : undefined;
		const candidates = [...requests.values()].flatMap(({ placement: { id }, salience }) =>
			salience ? [{ id, ...salience, selected: id === selectedId, hovered: id === pointed }] : []
		);
		const levels = selectHouseDetail(candidates, town?.world.world.seed ?? 0);
		const shares = shareBlockBudget(candidates, blockTriangleBudget);
		return new Map(
			[...requests.keys()].map((id): [string, Detail] => {
				const level = levels.get(id) ?? 'plain';
				return [
					id,
					{ level, budget: (level === 'plain' ? undefined : shares.get(id)) ?? blockTriangleBudget }
				];
			})
		);
	}

	/** Brings the queue in line with the document: new requests wait, removed ones are cancelled. */
	function sync(previews?: ReadonlyMap<string, Drawable | undefined>) {
		const next = new Map(cache.read().map((request) => [request.placement.id, request]));
		for (const id of requests.keys()) if (!next.has(id)) queue.cancel(id);
		requests = next;
		if (previews)
			for (const [id, body] of previews) {
				const request = next.get(id);
				if (request && body) bodies.set(request, body);
			}
		submit();
	}

	function submit() {
		if (open) return;
		const details = readDetails();
		for (const [id, request] of requests) {
			const build = request.build;
			const detail = details.get(id);
			if (!build || !detail) continue;
			if (!serials.has(request)) serials.set(request, serial++);
			const key = `${serials.get(request)}/${detail.level}/${detail.budget}`;
			queue.submit({ id, key, run: () => build(detail) });
		}
		compose();
		frameWork = queue.readWaiting() ? { run: pump } : undefined;
	}

	let shownAt = 0;
	let unshown = false;

	/** Builds within the frame budget; shows new houses at a calm interval and when all are done. */
	function pump() {
		unshown = queue.advance().length > 0 || unshown;
		const done = queue.readWaiting() === 0;
		if (unshown && (done || performance.now() - shownAt >= showIntervalMs)) compose();
		else waiting = queue.readWaiting();
		return !done;
	}

	/** Shows each built house, or a plain body while it waits, plus garden and stroke marks. */
	function compose() {
		if (!town) return;
		shownAt = performance.now();
		unshown = false;
		const shown: Drawable[] = [];
		for (const [id, request] of requests) {
			if (open?.drawing.overrides.has(id)) continue;
			const product = queue.read(id);
			if (product) {
				shown.push(...product);
				continue;
			}
			if (!request.build || !request.parcel) continue;
			let body = bodies.get(request);
			if (!body) {
				const height = readPreviewHeight(Number(request.placement.params.height ?? 0));
				body = town.previewBody(request.parcel, id + '/body', request.placement.assetId, height);
				bodies.set(request, body);
			}
			shown.push(body);
		}
		if (open) for (const body of open.drawing.overrides.values()) if (body) shown.push(body);
		placed = shown;
		waiting = queue.readWaiting();
		history = documentModel.readHistory();
		selected = selectedId ? requests.get(selectedId)?.placement : undefined;
		if (selectedId && !selected) selectedId = undefined;
		marks = readMarks();
	}

	const skipMarks = new WeakMap<Parcel, Drawable>();
	const selectMarks = new WeakMap<Parcel, Drawable>();

	function readMarks() {
		if (!town) return [];
		const projection = town.projection;
		const list: Drawable[] = [];
		for (const [id, parcel] of open?.skipped ?? lastSkipped) {
			const mark =
				skipMarks.get(parcel) ?? projection.projectMark(parcel, 'skip/' + id, '--signal');
			skipMarks.set(parcel, mark);
			list.push(mark);
		}
		const chosen = selected && requests.get(selected.id)?.parcel;
		if (chosen) {
			const mark =
				selectMarks.get(chosen) ?? projection.projectMark(chosen, 'selected', '--blueprint');
			selectMarks.set(chosen, mark);
			list.push(mark);
		}
		return list;
	}
	let lastSkipped = new Map<string, Parcel>();

	function preview(parcels: readonly Parcel[], draft: Draft) {
		if (!town) return;
		const { world, readBrushParams, previewBody } = town;
		const { tool: active, tally, skipped, drawing } = draft;
		for (const parcel of parcels) {
			const host = address(parcel.id);
			const current = documentModel.readPlacement(host);
			if (active === 'erase' || active === 'reseed') {
				if (!current) continue;
				if (active === 'erase') {
					drawing.add({ kind: 'remove', id: current.id }, { id: current.id });
					tally.removed++;
				} else {
					drawing.add({
						kind: 'replace',
						id: current.id,
						params: current.params,
						seed: reseed(current)
					});
					tally.reseeded++;
				}
				continue;
			}
			if (current) {
				tally.occupied++;
				skipped.set(parcel.id, parcel);
				continue;
			}
			try {
				const edit = world.place(active, host, readBrushParams(active));
				const id = readPlacementId(documentModel.world, host);
				const height = readPreviewHeight(Number(edit.params.height ?? 0));
				const body = previewBody(parcel, id + '/body', active, height);
				drawing.add(edit, { id, body });
				tally.placed++;
			} catch (error) {
				if (!(error instanceof UnavailableHostError)) throw error;
				tally.off++;
				skipped.set(parcel.id, parcel);
			}
		}
	}

	function reseed(current: SandboxPlacement) {
		return Random.create({ seed: current.seed }).derive('sandbox-reseed').seed;
	}

	function strokeTool() {
		return tool === 'paint' ? style : tool;
	}

	function effect(next: StrokeEffect<Parcel>) {
		if (next.kind === 'hover') {
			hovered = next.host;
			return;
		}
		if (next.kind === 'begin') {
			open = {
				tool: next.tool,
				drawing: createStrokeDraft<SandboxEdit, Drawable>(),
				tally: { placed: 0, removed: 0, reseeded: 0, occupied: 0, off: 0 },
				skipped: new Map()
			};
			return;
		}
		if (!open) return;
		if (next.kind === 'enter') {
			try {
				preview(next.hosts, open);
				compose();
			} catch (error) {
				fail(error);
			}
			return;
		}
		const ended = open;
		open = undefined;
		if (next.kind === 'release') lastSkipped = ended.skipped;
		try {
			let changes: readonly PlacementChange[] = [];
			ended.drawing.finish(next.kind, (edits, previews) => {
				changes = documentModel.apply(edits);
				if (changes.length) sync(previews);
			});
			if (next.kind === 'cancel') status = 'Stroke cancelled.';
			else status = report(ended.tally, changes);
			if (!changes.length) compose();
		} catch (error) {
			compose();
			fail(error);
		}
	}

	function report(tally: Tally, changes: readonly PlacementChange[]) {
		const gardens = changes.filter(({ id, after }) => after && requests.get(id)?.reason);
		const why = [
			...new Set(gardens.map(({ id }) => reasons[requests.get(id)?.reason ?? ''] ?? ''))
		];
		const noun = (field: 'before' | 'after') => {
			const assets = changes.flatMap((change) => change[field]?.assetId ?? []);
			if (assets.every((id) => town?.isHouse(id))) return 'house';
			return assets.every((id) => !town?.isHouse(id)) ? 'grove' : 'placement';
		};
		const parts = [
			tally.placed - gardens.length > 0 &&
				plural(tally.placed - gardens.length, noun('after')) + ' placed',
			gardens.length && `${plural(gardens.length, 'parcel')} kept as garden: ${why.join(', ')}`,
			tally.removed && plural(tally.removed, noun('before')) + ' erased',
			tally.reseeded && plural(tally.reseeded, noun('after')) + ' reseeded',
			tally.occupied && `${tally.occupied} already built`,
			tally.off && `${tally.off} public`
		].filter(Boolean);
		return parts.length ? parts.join(' · ') + '.' : 'Nothing changed.';
	}

	function groundPointer(input: GroundPointer) {
		if (!town || loading) return;
		const { event } = input;
		if (event.pointerType === 'touch' && event.type === 'pointerdown' && !event.isPrimary) {
			// A second finger turns the gesture into navigation; the open stroke is taken back.
			for (const next of stroke.read({ type: 'cancel', pointer: lastPointer, hits: [], tool }))
				effect(next);
			pointer.release();
			panning = true;
			return;
		}
		if (event.type === 'pointerup' && event.pointerType === 'touch' && event.isPrimary)
			panning = false;
		if (!open && (tool === 'select' || panning)) return selectPointer(input);
		const read = pointer.read(input, strokeTool());
		if (!read) return;
		lastPointer = read.pointer;
		for (const next of stroke.read(read)) effect(next);
	}
	let lastPointer = -1;

	function selectPointer({ event, ground }: GroundPointer) {
		const position = ground && town?.projection.toWorld(ground[0], ground[1]);
		const before = hoveredRequest?.placement.id;
		hovered = position && town?.world.polygons.readPoint(position);
		if (panning || tool !== 'select') return;
		if (hoveredRequest?.placement.id !== before) submit();
		if (event.type === 'pointerdown') press = { x: event.clientX, y: event.clientY };
		if (event.type !== 'pointerup' || !press) return;
		const travel = Math.hypot(event.clientX - press.x, event.clientY - press.y);
		press = undefined;
		if (travel > (town?.clickSlopPx ?? 0)) return;
		const request = hovered && readRequest(hovered.id);
		selectedId = request?.placement.id;
		status = request ? '' : 'Nothing to select here.';
		submit();
	}

	function apply(edits: readonly SandboxEdit[], message = '') {
		if (open) return;
		try {
			if (documentModel.apply(edits).length) sync();
			status = message;
		} catch (error) {
			fail(error);
		}
	}

	function moveHistory(direction: 'undo' | 'redo') {
		if (!town || loading || stroke.isOpen()) return;
		try {
			const changes = documentModel[direction]();
			if (changes.length) sync();
			status = changes.length
				? `${direction === 'undo' ? 'Undid' : 'Redid'} ${plural(changes.length, 'change')}.`
				: '';
		} catch (error) {
			fail(error);
		}
	}

	function clear() {
		const all = documentModel.readPlacements();
		apply(
			all.map(({ id }) => ({ kind: 'remove', id })),
			`Cleared ${plural(all.length, 'placement')}.`
		);
	}

	function setParam(key: string, value: number) {
		if (!selected || selected.params[key] === value) return;
		apply(
			[{ kind: 'replace', id: selected.id, params: { ...selected.params, [key]: value } }],
			`${asset?.params[key]?.label ?? key} set to ${value}.`
		);
	}

	function setStyle(assetId: string) {
		if (!town) return;
		if (tool !== 'select' || !selected) {
			style = assetId;
			return;
		}
		if (selected.assetId === assetId) return;
		const { id, host, params, seed } = selected;
		apply(
			[
				{ kind: 'remove', id },
				{
					kind: 'place',
					assetId,
					host,
					seed,
					params:
						town.isHouse(assetId) === town.isHouse(selected.assetId)
							? params
							: town.readBrushParams(assetId)
				}
			],
			`Restyled as ${styleNames[assetId]}.`
		);
	}

	function reseedSelected() {
		if (selected)
			apply(
				[{ kind: 'replace', id: selected.id, params: selected.params, seed: reseed(selected) }],
				'Reseeded.'
			);
	}

	function removeSelected() {
		if (selected)
			apply(
				[{ kind: 'remove', id: selected.id }],
				town?.isHouse(selected.assetId) ? 'House removed.' : 'Grove removed.'
			);
	}

	function shortcut(event: KeyboardEvent) {
		if (event.defaultPrevented || loading || !town) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input, textarea, [contenteditable], [role="combobox"]')
		)
			return;
		const key = event.key.toLowerCase();
		const command = event.ctrlKey || event.metaKey;
		if (key === ' ' && !event.repeat) {
			panning = event.type === 'keydown';
			if (event.target instanceof HTMLCanvasElement) event.preventDefault();
			return;
		}
		if (event.type !== 'keydown') return;
		if (command && !event.altKey && (key === 'z' || key === 'y')) {
			event.preventDefault();
			moveHistory(event.shiftKey || key === 'y' ? 'redo' : 'undo');
		} else if (key === 'escape') {
			const wasOpen = stroke.isOpen();
			for (const next of stroke.read({ type: 'cancel', pointer: lastPointer, hits: [], tool }))
				effect(next);
			pointer?.release();
			if (selectedId && !wasOpen) {
				selectedId = undefined;
				submit();
			}
		} else if ((key === 'delete' || key === 'backspace') && selected) {
			removeSelected();
		} else if (!command && !event.altKey && toolKeys.has(key.toUpperCase())) {
			tool = toolKeys.get(key.toUpperCase()) ?? tool;
			submit();
		} else if (!command && !event.altKey && /^[1-9]$/.test(key)) {
			const choice = specimens[Number(key) - 1];
			if (choice) setStyle(choice.value);
		}
	}

	function save() {
		const blob = new Blob([documentModel.serialize()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'sandbox.json';
		link.click();
		setTimeout(() => URL.revokeObjectURL(url));
		status = 'Saved sandbox.json.';
	}

	async function load(file: File) {
		if (!town || loading) return;
		loading = true;
		try {
			stroke.reset();
			pointer.release();
			open = undefined;
			const next = town.world.restore(await file.text());
			const nextCache = town.createCache(next);
			for (const id of requests.keys()) queue.cancel(id);
			requests = new Map();
			documentModel = next;
			cache = nextCache;
			hovered = undefined;
			selectedId = undefined;
			lastSkipped = new Map();
			sync();
			status = `Loaded ${plural(next.readHistory().placements, 'placement')}.`;
		} catch (error) {
			fail(error);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Sandbox · City Design System</title></svelte:head>
<svelte:window onkeydown={shortcut} onkeyup={shortcut} />

<section class="sandbox">
	<h1>Sandbox</h1>
	{#if town}
		<div
			class="sandbox-stage"
			data-sandbox-waiting={waiting}
			data-sandbox-placements={history.placements}
		>
			<StageView
				{drawables}
				{view}
				{fit}
				display="normal"
				label="Editable town parcels"
				landscape
				interactive
				panOnDrag={(tool === 'select' || panning) && !loading}
				onGroundPointer={groundPointer}
				{frameWork}
			/>
			<div class="sandbox-hud">
				<div class="sandbox-hud-tools">
					<ToolBar
						label="Sandbox tools"
						{tools}
						bind:value={() => tool, (next: string) => ((tool = next as Tool), submit())}
						actions={[
							{
								value: 'undo',
								label: 'Undo',
								icon: 'undo',
								shortcut: 'Ctrl+Z',
								disabled: loading || !history.position,
								onclick: () => moveHistory('undo')
							},
							{
								value: 'redo',
								label: 'Redo',
								icon: 'redo',
								shortcut: 'Ctrl+Shift+Z',
								disabled: loading || history.position === history.strokes,
								onclick: () => moveHistory('redo')
							}
						]}
					/>
				</div>
				<div class="sandbox-hud-view">
					<ToggleGroup
						label="View"
						items={views}
						bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
					/>
				</div>
				{#if tool === 'paint' || (tool === 'select' && selected)}
					<div
						class="sandbox-hud-panel panel"
						data-inspector={tool === 'select' && selected ? '' : undefined}
					>
						{#if tool === 'select' && selected && asset}
							<p class="label">{styleNames[selected.assetId]}</p>
						{:else}
							<p class="label">Brush</p>
						{/if}
						<SpecimenPicker
							label="Parcel brush"
							items={specimens}
							bind:value={
								() => (tool === 'select' && selected ? selected.assetId : style), setStyle
							}
						/>
						{#if tool === 'select' && selected && asset}
							{#each Object.entries(asset.params) as [key, param] (key)}
								<Slider
									label={`${param.label} · ${selected.params[key]} ${param.unit}`}
									min={param.min}
									max={param.max}
									step={param.step}
									value={selected.params[key] ?? param.default}
									onCommit={(value: number) => setParam(key, value)}
								/>
							{/each}
							<div class="cluster">
								<IconButton label="Reseed (R)" icon="dices" onclick={reseedSelected} />
								<IconButton label="Remove (Delete)" icon="trash" onclick={removeSelected} />
							</div>
						{/if}
					</div>
				{/if}
				<p class="sandbox-hud-status small" role="status">
					<span
						>{status ||
							`${plural(history.placements, 'placement')} on ${history.strokes ? plural(history.position, 'stroke') : 'an empty town'}.`}</span
					>
					{#if waiting}<span class="data">Building {waiting}…</span>{/if}
					<span class="sandbox-hint"
						>{hint} · Space-drag or two fingers to move · Scroll to zoom</span
					>
				</p>
				<div class="sandbox-hud-file cluster" role="group" aria-label="Document">
					<IconButton label="Save" icon="download" disabled={loading} onclick={save} />
					<FilePicker
						label="Load"
						icon="upload"
						accept=".json,application/json"
						disabled={loading}
						onfile={(file: File) => void load(file)}
					/>
					<IconButton
						label="Clear"
						icon="trash"
						disabled={loading || !history.placements}
						onclick={clear}
					/>
				</div>
			</div>
		</div>
	{:else}
		<p class="small" role="status">{status || 'Opening town…'}</p>
	{/if}
</section>
