import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: the city is the home page. */
export const load = () => redirect(308, resolve('/'));
