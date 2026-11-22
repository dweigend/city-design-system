<script lang="ts">
	import { Popover } from 'bits-ui';
	import { Menu } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { chapters } from '../data/chapters';
	import { ThemeToggle } from '../theme';

	let { height = $bindable(0) }: { height?: number } = $props();
	let open = $state(false);
	const archive = resolve('/archiv');
</script>

<header class="bible-bar" bind:offsetHeight={height}>
	<Popover.Root bind:open>
		<Popover.Trigger class="bible-menu-trigger">
			<Menu size={18} aria-hidden="true" />
			Chapters
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content class="bible-menu" align="start" sideOffset={0} collisionPadding={8}>
				<nav aria-label="Chapters">
					<ul>
						{#each chapters as chapter (chapter.slug)}
							{@const href = resolve('/[...bible]', { bible: chapter.slug })}
							<li class:subchapter={chapter.number === 9.1}>
								<a
									{href}
									aria-current={page.url.pathname === href ? 'page' : undefined}
									onclick={() => (open = false)}
								>
									<span class="number" aria-hidden="true">{chapter.number}</span>
									{chapter.title}
								</a>
							</li>
						{/each}
						<li class="archive">
							<a
								href={archive}
								aria-current={page.url.pathname === archive ? 'page' : undefined}
								onclick={() => (open = false)}>Archive</a
							>
						</li>
					</ul>
				</nav>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
	<ThemeToggle />
</header>

<style>
	.bible-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-inline: var(--space-3);
		border-bottom: var(--hair) solid var(--line);
		background: var(--paper);
	}
	:global(.bible-menu-trigger) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding-inline: var(--space-2);
		border: 0;
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global(.bible-menu-trigger:hover),
	:global(.bible-menu-trigger[data-state='open']) {
		background: var(--paper-3);
	}
	:global(.bible-menu) {
		z-index: 5;
		box-sizing: border-box;
		width: min(20rem, calc(100vw - 1rem));
		max-height: var(--bits-popover-content-available-height);
		overflow-y: auto;
		overscroll-behavior: contain;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		box-sizing: border-box;
		min-height: 44px;
		padding: var(--space-1) var(--space-3);
		color: var(--ink);
		font-size: var(--text-s);
		text-decoration: none;
		touch-action: manipulation;
	}
	a:hover,
	a[aria-current='page'] {
		background: var(--paper-3);
	}
	a[aria-current='page'] {
		font-weight: 650;
	}
	a:focus-visible {
		outline-offset: -3px;
	}
	.number {
		flex: 0 0 2ch;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.subchapter a {
		padding-inline-start: var(--space-6);
	}
	.archive {
		border-top: var(--hair) solid var(--line);
	}
</style>
