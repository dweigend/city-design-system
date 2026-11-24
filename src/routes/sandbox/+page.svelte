<script lang="ts">
	import { onMount } from 'svelte';
	import { Random } from '../../lib/core/random';
	import type { Parcel } from '../../lib/domain/parcels';
	import {
		type createSandboxDocument,
		type SandboxEdit,
		type SandboxPlacement
	} from '../../lib/domain/sandbox-document';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import { StageView, type GroundPointer } from '../../lib/scene/stage-view';
	import type { Drawable } from '../../lib/scene/surface';
	import { Button } from '../../lib/ui/button';
	import { FilePicker } from '../../lib/ui/file-picker';
	import { Select } from '../../lib/ui/select';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { UnavailableHostError } from '../../lib/world/sandbox-world';
	import { createStroke } from './stroke';
	import { createTownSandbox } from './town';

	const names: Readonly<Record<string, string>> = {
		'house/court-neutral': 'Neutral',
		'house/court-memphis': 'Memphis',
		'house/court-archigram': 'Archigram',
		'house/court-organic': 'Organic'
	};
	const views = [
		{ value: 'iso', label: '3D' },
		{ value: 'plan', label: 'Plan' }
	];
	type Town = ReturnType<typeof createTownSandbox>;
	let town = $state.raw<Town>();
	let layout = $state.raw<Town['projection']['background']>([]);
	let gardens = $state(0);
	let history = $state({ placements: 0, strokes: 0, position: 0 });
	let documentModel: ReturnType<typeof createSandboxDocument>;
	let cache: ReturnType<Town['createCache']>;
	let paint: ReturnType<typeof createStroke>;
	let placed = $state.raw<readonly Drawable[]>([]);
	let hovered = $state.raw<Parcel>();
	let hoveredPlacement = $state.raw<SandboxPlacement>();
	let view = $state<View>('iso');
	let tool = $state('house/court-neutral');
	let status = $state('');
	let loading = $state(false);
	const items = $derived([
		...(town?.assets ?? []).map(({ id }) => ({ value: id, label: names[id] ?? id })),
		{ value: 'erase', label: 'Eraser' },
		{ value: 'explore', label: 'Explore' }
	]);
	const fit = $derived(
		town && { fill: town.viewContextFill, subject: projectFocus(view, {}, town.points) }
	);
	const marker = $derived(town && hovered && town.projection.projectHover(hovered));
	const drawables = $derived([...layout, ...placed, ...(marker ? [marker] : [])]);
	const parcelAddress = (id: string) => ({ kind: 'parcel', id }) as const;

	onMount(() => {
		try {
			const opened = createTownSandbox();
			documentModel = opened.world.createDocument();
			cache = opened.createCache(documentModel);
			paint = createStroke(opened.world.polygons, opened.projection.toWorld, selectParcel, commit);
			layout = opened.projection.background;
			town = opened;
		} catch (error) {
			fail(error);
		}
	});

	function fail(error: unknown) {
		status = error instanceof Error ? error.message : 'Could not update the sandbox.';
	}

	function selectParcel(parcel: Parcel | undefined) {
		hovered = parcel;
		hoveredPlacement = parcel && documentModel.readPlacement(parcelAddress(parcel.id));
	}

	function refresh() {
		history = documentModel.readHistory();
		selectParcel(hovered);
		const products = cache.read();
		gardens = products.filter(({ reason }) => reason).length;
		placed = products.flatMap(({ drawables }) => drawables);
	}

	function apply(edits: readonly SandboxEdit[]) {
		if (!documentModel.apply(edits).length) return;
		refresh();
	}

	function commit(parcels: readonly Parcel[], activeTool: string) {
		if (!town || loading) return;
		const edits: SandboxEdit[] = [];
		let occupied = 0;
		let unavailable = 0;
		for (const parcel of parcels) {
			const address = parcelAddress(parcel.id);
			const current = documentModel.readPlacement(address);
			if (activeTool === 'erase') {
				if (current) edits.push({ kind: 'remove', id: current.id });
				continue;
			}
			if (current) {
				occupied++;
				continue;
			}
			try {
				edits.push(town.world.place(activeTool, address, town.brushParams));
			} catch (error) {
				if (!(error instanceof UnavailableHostError)) return fail(error);
				unavailable++;
			}
		}
		try {
			apply(edits);
			const skipped = [
				occupied && `${occupied} occupied`,
				unavailable && `${unavailable} unavailable`
			].filter(Boolean);
			status = skipped.length ? `Skipped ${skipped.join(', ')}.` : '';
		} catch (error) {
			fail(error);
		}
	}

	function groundPointer(pointer: GroundPointer) {
		paint.read(pointer, tool, loading);
	}

	function moveHistory(direction: 'undo' | 'redo') {
		if (!town || loading) return;
		try {
			if (documentModel[direction]().length) refresh();
			status = '';
		} catch (error) {
			fail(error);
		}
	}

	function reseed() {
		const current = hoveredPlacement;
		if (!current || loading) return;
		const seed = Random.create({ seed: current.seed }).derive('sandbox-reseed').seed;
		try {
			apply([{ kind: 'replace', id: current.id, params: current.params, seed }]);
			status = '';
		} catch (error) {
			fail(error);
		}
	}

	function clear() {
		apply(documentModel.readPlacements().map(({ id }) => ({ kind: 'remove', id })));
		status = '';
	}

	function shortcut(event: KeyboardEvent) {
		if (event.defaultPrevented || loading || !town) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input, textarea, [contenteditable], [role="combobox"]')
		)
			return;
		const key = event.key.toLowerCase();
		if ((event.ctrlKey || event.metaKey) && !event.altKey && (key === 'z' || key === 'y')) {
			event.preventDefault();
			moveHistory(event.shiftKey || key === 'y' ? 'redo' : 'undo');
		} else if (
			event.target instanceof HTMLCanvasElement &&
			key === 'r' &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey
		) {
			reseed();
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
	}

	async function load(file: File) {
		if (!town || loading) return;
		loading = true;
		try {
			paint.cancel();
			const next = town.world.restore(await file.text());
			const nextCache = town.createCache(next);
			documentModel = next;
			cache = nextCache;
			hovered = undefined;
			refresh();
			status = 'Sandbox loaded.';
		} catch (error) {
			fail(error);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Sandbox · City Design System</title></svelte:head>
<svelte:window onkeydown={shortcut} />

<section class="sandbox">
	<h1>Sandbox</h1>
	{#if town}
		<div class="sandbox-tools" role="group" aria-label="Sandbox tools">
			<Select label="Tool" {items} bind:value={tool} />
			<ToggleGroup
				label="View"
				items={views}
				bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
			/>
			<div class="sandbox-tools" role="group" aria-label="History">
				<Button
					label="Undo"
					disabled={loading || !history.position}
					onclick={() => moveHistory('undo')}
				/>
				<Button
					label="Redo"
					disabled={loading || history.position === history.strokes}
					onclick={() => moveHistory('redo')}
				/>
				<Button label="Reseed" disabled={loading || !hoveredPlacement} onclick={reseed} />
			</div>
			<div class="sandbox-tools" role="group" aria-label="Document">
				<Button label="Save" disabled={loading} onclick={save} />
				<FilePicker
					label="Load"
					accept=".json,application/json"
					disabled={loading}
					onfile={(file: File) => void load(file)}
				/>
				<Button label="Clear" disabled={loading || !history.placements} onclick={clear} />
			</div>
		</div>
		<p class="small sandbox-status" role="status">
			<span
				>{history.placements} placements · {history.strokes} strokes · History {history.position}/{history.strokes}</span
			>
			{#if gardens}<span
					>{gardens} unbuildable {gardens === 1 ? 'parcel' : 'parcels'} kept as garden.</span
				>{/if}
			{#if status}<span>{status}</span>{/if}
		</p>
		<StageView
			{drawables}
			{view}
			{fit}
			display="normal"
			label="Editable town parcels"
			landscape
			interactive
			panOnDrag={tool === 'explore' && !loading}
			onGroundPointer={groundPointer}
		/>
	{:else}
		<p class="small" role="status">{status || 'Opening town…'}</p>
	{/if}
</section>
