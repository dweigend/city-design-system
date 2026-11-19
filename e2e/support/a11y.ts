import type { Page } from '@playwright/test';

/**
 * Accessibility probes on the live page: accessible names from Chromium's accessibility tree,
 * and a keyboard walk that records every Tab stop and whether its focus is visible (DS-60).
 */

/** Roles a reader operates; each must carry a non-empty accessible name. */
const NAMED_ROLES = new Set([
	'button',
	'link',
	'textbox',
	'searchbox',
	'spinbutton',
	'slider',
	'checkbox',
	'radio',
	'switch',
	'tab',
	'combobox',
	'menuitem',
	'option',
	'radiogroup',
	'tablist',
	'listbox',
	'image',
	'img'
]);

type AXNode = {
	ignored?: boolean;
	role?: { value?: string };
	name?: { value?: string };
	backendDOMNodeId?: number;
};

/** Controls and images in the accessibility tree that have no accessible name. */
export async function unnamedNodes(page: Page): Promise<string[]> {
	const cdp = await page.context().newCDPSession(page);
	try {
		const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
		const unnamed = nodes.filter(
			(n) => !n.ignored && NAMED_ROLES.has(n.role?.value ?? '') && !n.name?.value?.trim()
		);
		const described: string[] = [];
		for (const node of unnamed) {
			const { object } = await cdp.send('DOM.resolveNode', {
				backendNodeId: node.backendDOMNodeId
			});
			const html = await cdp.send('Runtime.callFunctionOn', {
				objectId: object.objectId,
				functionDeclaration:
					'function () { return this.outerHTML?.slice(0, 160) ?? this.nodeName; }',
				returnByValue: true
			});
			described.push(`${node.role?.value}: ${html.result.value}`);
		}
		return described;
	} finally {
		await cdp.detach();
	}
}

export type KeyboardWalk = {
	/** Number of distinct Tab stops before focus wrapped around. */
	stops: number;
	/** Tab stops whose focus leaves no visible trace. */
	invisibleFocus: string[];
	/** Visible, enabled, tabbable controls that Tab never reached. */
	unreached: string[];
};

/**
 * Installs a focus recorder and moves focus to the start of the document. Transitions are
 * switched off for the walk, so the probe reads each focus style in its final state.
 */
async function startWalk(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; }'
	});
	await page.evaluate(() => {
		const w = window as unknown as { __tabStops: Set<Element> };
		w.__tabStops = new Set();
		document.addEventListener('focusin', (e) => w.__tabStops.add(e.target as Element));
		// Fixed starting point: a non-tabbable anchor before all content, so the first Tab
		// lands on the first control regardless of earlier clicks or focus.
		const start = document.createElement('span');
		start.tabIndex = -1;
		document.body.prepend(start);
		start.focus();
		window.scrollTo(0, 0);
	});
}

/**
 * Computed look of the focused element, its first descendants and its parent. A focus style
 * may draw an outline, a ring, a border, a fill or a heavier SVG stroke; any of them counts.
 */
function focusLook(marker: string): string {
	const el = document.querySelector(`[${marker}]`) ?? document.activeElement;
	if (!el) return '';
	const props = [
		'outline-style',
		'outline-width',
		'outline-color',
		'box-shadow',
		'border-color',
		'background-color',
		'color',
		'text-decoration-line',
		'stroke',
		'stroke-width',
		'stroke-dasharray',
		'fill'
	];
	const look = (e: Element) => {
		const s = getComputedStyle(e);
		return props.map((p) => s.getPropertyValue(p)).join('|');
	};
	const parts = [el, ...Array.from(el.querySelectorAll('*')).slice(0, 30), el.parentElement];
	return parts.map((e) => (e ? look(e) : '')).join(';');
}

/** Checks the current Tab stop: returns its description, whether it repeats, and whether focus shows. */
async function inspectStop(page: Page) {
	const info = await page.evaluate(() => {
		const el = document.activeElement as HTMLElement | null;
		if (!el || el === document.body) return null;
		const s = getComputedStyle(el);
		const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
		el.setAttribute('data-e2e-focus', '');
		return { html: el.outerHTML.slice(0, 160), outline };
	});
	if (!info) return null;
	if (info.outline) {
		await page.evaluate(() =>
			document.querySelector('[data-e2e-focus]')?.removeAttribute('data-e2e-focus')
		);
		return { html: info.html, visible: true };
	}
	const focused = await page.evaluate(focusLook, 'data-e2e-focus');
	await page.evaluate(() => (document.querySelector('[data-e2e-focus]') as HTMLElement).blur());
	const plain = await page.evaluate(focusLook, 'data-e2e-focus');
	await page.evaluate(() => {
		const el = document.querySelector('[data-e2e-focus]') as HTMLElement;
		el.removeAttribute('data-e2e-focus');
		el.focus({ preventScroll: true });
	});
	return { html: info.html, visible: focused !== plain };
}

/** Lists visible, enabled, tabbable controls that the walk did not reach. */
async function unreachedControls(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const w = window as unknown as { __tabStops: Set<Element> };
		const selector =
			'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
		return Array.from(document.querySelectorAll<HTMLElement>(selector))
			.filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled)
			.filter((el) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[inert]'))
			.filter((el) => !w.__tabStops.has(el))
			.map((el) => el.outerHTML.slice(0, 160));
	});
}

/** Tabs through the whole page once and reports reach and focus visibility. */
export async function walkKeyboard(page: Page, maxStops = 400): Promise<KeyboardWalk> {
	await startWalk(page);
	const invisibleFocus: string[] = [];
	let first: string | undefined;
	let stops = 0;
	for (; stops < maxStops; stops++) {
		await page.keyboard.press('Tab');
		const stop = await inspectStop(page);
		if (!stop || stop.html === first) break;
		first ??= stop.html;
		if (!stop.visible) invisibleFocus.push(stop.html);
	}
	return { stops, invisibleFocus, unreached: await unreachedControls(page) };
}
