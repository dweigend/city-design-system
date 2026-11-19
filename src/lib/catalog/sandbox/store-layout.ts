type Breakpoint = {
	readonly matches: boolean;
	addEventListener(type: 'change', update: () => void): void;
	removeEventListener(type: 'change', update: () => void): void;
};

/** Reports the initial Store layout and closes the mobile popup when its trigger is hidden. */
export function watchStoreLayout(
	breakpoint: Breakpoint,
	showMobile: (mobile: boolean) => void,
	close: () => void
) {
	const update = () => {
		showMobile(breakpoint.matches);
		if (!breakpoint.matches) close();
	};
	update();
	breakpoint.addEventListener('change', update);
	return () => breakpoint.removeEventListener('change', update);
}
