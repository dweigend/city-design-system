import { settings } from '../../../config/hydrology';

export const setbackM = settings.setbackM.value;
export const triangleCount = (indices: readonly number[]) => indices.length / 3;
