<script lang="ts">
	import AssetSheet from '#lib/catalog/labor/AssetSheet.svelte';
	import { page } from '$app/state';
</script>

<AssetSheet group={page.url.searchParams.get('group')} />
