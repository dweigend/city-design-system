import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: the former overview is distributed over the nine chapters. */
export const load = () => redirect(308, resolve('/'));
