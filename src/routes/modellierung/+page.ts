import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** Old address: Modellierung is now called Growth. */
export const load = () => redirect(308, resolve('/wachstum'));
