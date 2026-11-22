import { Valley } from '../../domain/valley';
import { projectValley } from './index';

export const valleyProjectionExample = () => projectValley(Valley.create({ seed: 1201 }));
