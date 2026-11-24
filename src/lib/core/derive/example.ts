import { createDeriveCache } from './index';

export function example() {
	const scope = {};
	const heightAt = createDeriveCache<object, number>();
	return [
		heightAt(scope, ['datum'], '0', () => 0),
		heightAt(scope, ['datum'], '1', () => 35),
		heightAt(scope, ['datum'], '0', () => 0)
	];
}
