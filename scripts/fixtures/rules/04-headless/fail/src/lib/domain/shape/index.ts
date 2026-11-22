import 'three/webgpu';
import 'svelte/store';
import 'bits-ui';
import 'lucide-svelte';
import '$app/state';
import './Widget.svelte';

export const browser = [window, document, navigator, globalThis.requestAnimationFrame];
