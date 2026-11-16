<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { Moon, Sun, SunMoon } from 'lucide-svelte';
	import Icon from '../ui/Icon.svelte';
	import { theme, setThemeChoice, type ThemeChoice } from './theme.svelte';

	/**
	 * Color mode: System, Light, Dark. Compact as icons, name via aria-label and title.
	 * The selection comes from data-theme-choice on <html>, so it is already correct before
	 * hydration; Bits UI keeps focus and aria state.
	 */
	const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
		{ value: 'system', label: 'Match system', icon: SunMoon },
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon }
	];
</script>

<ToggleGroup.Root
	type="single"
	value={theme.choice}
	onValueChange={(v) => v && setThemeChoice(v as ThemeChoice)}
	class="cg-theme"
	aria-label="Color mode"
>
	{#each options as o (o.value)}
		<ToggleGroup.Item
			value={o.value}
			class="cg-theme-item"
			data-choice={o.value}
			aria-label={o.label}
			title={o.label}
		>
			<Icon icon={o.icon} size={16} />
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.cg-theme) {
		display: inline-flex;
		flex: none;
		border: var(--hair) solid var(--line);
	}
	:global(.cg-theme-item) {
		display: grid;
		place-items: center;
		width: calc(var(--ctl-s) + var(--space-2));
		height: calc(var(--ctl-s) + var(--space-2));
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}
	:global(.cg-theme-item:hover) {
		color: var(--ink);
	}
	:global(.cg-theme-item:focus-visible) {
		outline-offset: -2px;
	}
	:global(:root[data-theme-choice='system'] .cg-theme-item[data-choice='system']),
	:global(:root[data-theme-choice='light'] .cg-theme-item[data-choice='light']),
	:global(:root[data-theme-choice='dark'] .cg-theme-item[data-choice='dark']) {
		background: var(--paper-3);
		color: var(--ink);
	}
</style>
