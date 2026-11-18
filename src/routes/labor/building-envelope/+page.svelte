<script lang="ts">
	import EnvelopePlate from '#lib/catalog/labor/EnvelopePlate.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<EnvelopePlate meshes={data.meshes} />
