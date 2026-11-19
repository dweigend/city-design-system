<script lang="ts">
	import AssetSheet from '#lib/catalog/labor/AssetSheet.svelte';
	import { page } from '$app/state';
	import type { AssetCategory } from '#lib/catalog/logic/assets';
</script>

<AssetSheet category={(page.url.searchParams.get('group') || 'facades') as AssetCategory} />
