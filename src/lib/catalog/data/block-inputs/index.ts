import { defineParams, numberParam, type ParamOverrides } from '../../core/params';

/** Proposed common block parameters. Steps describe controls. Bounds are inclusive. */
export const blockInputs = defineParams({
	height: numberParam('Height', 'm', 4, [1, 32, 0.1]),
	width: numberParam('Width', 'm', 9, [1, 32, 0.1]),
	complexity: numberParam('Complexity', '', 0.5, [0, 1, 0.01])
});

export type BlockInputs = Required<ParamOverrides<typeof blockInputs>>;
