import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: the archive unites designs, library and references. */
export const load = () => redirect(308, resolve('/archiv'));
