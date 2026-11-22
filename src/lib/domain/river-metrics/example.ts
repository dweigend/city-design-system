import { measureRiver } from './index';

export const riverMetricsExample = () =>
	measureRiver({
		xy: [-500, 0, 500, 0],
		wetWidth: 300,
		bankfullWidth: 320,
		bearing: 0
	});
