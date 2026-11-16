import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: the principles stand in the Lab under “How the city computes”. */
export const load = () => redirect(308, resolve('/labor') + '#labor-rechnen');
