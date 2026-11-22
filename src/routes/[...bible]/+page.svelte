<script lang="ts">
	import { ChapterPage } from '#lib/catalog/chapter-frame/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ChapterPage slug={data.slug} docs={data.docs} />
