import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: icons belong to Interface. */
export const load = () => redirect(308, resolve('/interface'));
