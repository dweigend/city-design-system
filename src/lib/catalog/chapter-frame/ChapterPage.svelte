<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { chapters, legacyStep, type ChapterSlug } from '../data/chapters';
	import ChapterFrame from './ChapterFrame.svelte';

	let { slug }: { slug: ChapterSlug } = $props();
	const chapter = $derived(chapters.find((entry) => entry.slug === slug));
	const legacy = $derived(page.url.searchParams.get('legacy'));
	const moving = $derived(legacy !== null && legacyStep(legacy, '') !== undefined);
	let failed = $state(false);

	$effect(() => {
		const target = legacy === null ? undefined : legacyStep(legacy, location.hash);
		if (!target) return;
		const [bible, step] = target;
		const query = new SvelteURLSearchParams(location.search);
		query.delete('legacy');
		const search = query.size ? '?' + query.toString() : '';
		const path = resolve('/[...bible]', { bible });
		const url = `${path}${search}#${step}` as ResolvedPathname;
		void goto(url, { replace: true }).catch(() => (failed = true));
	});
</script>

{#if chapter && (!moving || failed)}
	{#key chapter.slug}
		<ChapterFrame {chapter} />
	{/key}
{/if}
