import { portalExample, runGravity } from '../../domain/structure';
import { projectStructure } from './projection';

/** Projects the standalone portal under its four roof loads. */
export function structureProjectionExample() {
	const { graph, loads } = portalExample();
	return projectStructure(graph, {
		view: 'utilization',
		analysis: runGravity(graph, loads),
		arrows: loads
	});
}
