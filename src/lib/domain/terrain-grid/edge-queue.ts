export class MinHeap<T> {
	private readonly items: T[] = [];

	constructor(private readonly compare: (a: T, b: T) => number) {}

	add(item: T) {
		const { items, compare } = this;
		let index = items.length;
		items.push(item);
		while (index > 0) {
			const parent = Math.floor((index - 1) / 2);
			if (compare(items[parent], item) <= 0) break;
			items[index] = items[parent];
			index = parent;
		}
		items[index] = item;
	}

	take(): T | undefined {
		const { items, compare } = this;
		const best = items[0];
		const last = items.pop();
		if (last === undefined || items.length === 0) return best;
		let index = 0;
		for (let child = 1; child < items.length; child = 2 * index + 1) {
			if (child + 1 < items.length && compare(items[child + 1], items[child]) < 0) child++;
			if (compare(last, items[child]) <= 0) break;
			items[index] = items[child];
			index = child;
		}
		items[index] = last;
		return best;
	}
}
