import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: focus belongs to Color. */
export const load = () => redirect(308, resolve('/farben'));
