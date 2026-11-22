<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Popover } from 'bits-ui';
	import { ChevronDown } from 'lucide-svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Icon from '../ui/Icon.svelte';
	import { ThemeToggle } from '../theme';
	import { kapitelGruppen } from '../data/kapitel';
	import KapitelNav from './KapitelNav.svelte';
	let {
		title,
		children,
		showTitle = true,
		navigation
	}: { title: string; children: Snippet; showTitle?: boolean; navigation?: Snippet } = $props();

	/**
	 * Header bar the same on every page: brand on the left, chapters, color mode on the right.
	 * The page title stands below it, so its length never shifts the bar.
	 * Below 1200 px the chapters collapse into a popover; brand and color mode stay in place.
	 */
	const current = $derived(
		kapitelGruppen
			.flatMap((g) => g.kapitel)
			.find(
				(k) =>
					page.url.pathname === resolve(k.pfad) ||
					(k.pfad !== '/' && page.url.pathname.startsWith(resolve(k.pfad) + '/'))
			)?.titel ?? 'Chapters'
	);
	let open = $state(false);
</script>

{#if navigation}
	{@render navigation()}
{:else}
	<header class="bar">
		<a class="brand" href={resolve('/')}>City Design System</a>
		<div class="inline"><KapitelNav /></div>
		<div class="compact">
			<Popover.Root bind:open>
				<Popover.Trigger class="cg-shell-trigger" aria-label="Choose a chapter, current: {current}">
					<span>{current}</span>
					<Icon icon={ChevronDown} size={16} />
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content class="cg-shell-pop" align="end" sideOffset={8} collisionPadding={16}>
						<KapitelNav compact onnavigate={() => (open = false)} />
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>
		<ThemeToggle />
	</header>
{/if}

<main class:without-title={!showTitle}>
	<h1 class:visually-hidden={!showTitle}>{title}</h1>
	{@render children()}
</main>

<style>
	.bar,
	main {
		max-width: 1440px;
		margin: 0 auto;
		padding-inline: var(--space-12);
	}
	/* One row, fixed height: brand | chapters | color mode. */
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-6);
		height: var(--space-16);
		border-bottom: var(--hair) solid var(--line);
	}
	.brand {
		flex: none;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}
	.inline,
	.compact {
		display: flex;
		flex: 1;
		justify-content: flex-end;
		min-width: 0;
	}
	.compact {
		display: none;
	}
	main {
		/* Scale thumbs at the maximum protrude over the edge; never horizontal scrolling of the page. */
		overflow-x: clip;
		padding-block: var(--space-12) var(--space-16);
	}
	h1 {
		margin-bottom: var(--space-12);
		font-size: var(--text-xxl);
		font-weight: 600;
		letter-spacing: -0.03em;
		text-transform: uppercase;
		line-height: 1;
		/* Long titles break with a hyphen instead of running over the edge. */
		hyphens: auto;
		overflow-wrap: break-word;
	}

	/* Trigger and popover are portaled or rendered by Bits UI: global classes with a prefix. */
	:global(.cg-shell-trigger) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 100%;
		height: calc(var(--ctl-s) + var(--space-2) + 2px);
		padding: 0 var(--space-2) 0 var(--space-3);
		border: var(--hair) solid var(--line);
		background: none;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: border-color var(--fast) var(--ease);
	}
	:global(.cg-shell-trigger > span) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.cg-shell-trigger:hover),
	:global(.cg-shell-trigger[data-state='open']) {
		border-color: var(--ink);
	}
	:global(.cg-shell-pop) {
		z-index: 50;
		min-width: 220px;
		padding: var(--space-4);
		border: var(--hair) solid var(--ink);
		background: var(--paper);
	}

	@media (max-width: 1199px) {
		.inline {
			display: none;
		}
		.compact {
			display: flex;
		}
	}
	@media (max-width: 720px) {
		.bar,
		main {
			padding-inline: var(--space-4);
		}
		.bar {
			gap: var(--space-3);
			height: var(--space-12);
		}
		main {
			padding-block: var(--space-8) var(--space-10);
		}
		h1 {
			margin-bottom: var(--space-8);
			font-size: var(--text-xl);
		}
	}
	main.without-title {
		padding-block-start: var(--space-4);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
