import type { FormFamily } from '../vocab';
import { placeholder } from './index';
const modules = import.meta.glob<{ formFamilies: FormFamily[] }>('../formen/index.ts', {
	eager: true
});
export const availableForms: FormFamily[] = Object.values(modules)[0]?.formFamilies ?? [
	placeholder
];
