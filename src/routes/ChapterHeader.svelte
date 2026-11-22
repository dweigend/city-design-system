<script lang="ts">
	let { number, title, lead }: { number: string; title: string; lead: string } = $props();
</script>

<header class="chapter-header stack">
	<div>
		<p class="label chapter-number">Chapter {number}</p>
		<h1>{title}</h1>
	</div>
	<p class="lead">{lead}</p>
</header>
