<script lang="ts">
	import StadtPage from '#lib/catalog/design/StadtPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<StadtPage study={data.study} />
