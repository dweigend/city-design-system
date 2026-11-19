import { onMount } from 'svelte';

/** Reports viewport proximity after the owning view mounts, then disconnects on destroy. */
export function observeSceneVisibility(
	host: () => HTMLElement,
	margin: string,
	update: (isIntersecting: boolean) => void
) {
	onMount(() => {
		const observer = new IntersectionObserver(([entry]) => update(entry.isIntersecting), {
			rootMargin: margin
		});
		observer.observe(host());
		return () => observer.disconnect();
	});
}

type SceneSize = {
	ready: Promise<unknown>;
	resize(widthPx: number, heightPx: number): void;
};

/** Sizes the scene immediately and on host resize. The owner disconnects it before disposal. */
export function observeSceneSize(host: HTMLElement, canvas: HTMLCanvasElement, scene: SceneSize) {
	void scene.ready.catch(() => {});
	const resize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
	const observer = new ResizeObserver(resize);
	observer.observe(host);
	resize();
	return () => observer.disconnect();
}
