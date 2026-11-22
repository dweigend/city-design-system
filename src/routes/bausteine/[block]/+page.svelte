<script lang="ts">
	import { BlockDocsPage } from '#lib/catalog/chapter-frame/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<BlockDocsPage {...data} />
