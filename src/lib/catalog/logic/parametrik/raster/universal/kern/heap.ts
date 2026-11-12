/** Small binary heap for Dijkstra. */
export class Heap {
	private keys: number[] = [];
	private vals: number[] = [];
	get size() {
		return this.keys.length;
	}
	push(key: number, val: number) {
		let i = this.keys.length;
		this.keys.push(key);
		this.vals.push(val);
		while (i > 0) {
			const up = (i - 1) >> 1;
			if (this.keys[up] <= key) break;
			this.keys[i] = this.keys[up];
			this.vals[i] = this.vals[up];
			i = up;
		}
		this.keys[i] = key;
		this.vals[i] = val;
	}
	pop(): [number, number] {
		const top: [number, number] = [this.keys[0], this.vals[0]],
			key = this.keys.pop()!,
			val = this.vals.pop()!,
			n = this.keys.length;
		if (n) {
			let i = 0;
			for (;;) {
				let c = 2 * i + 1;
				if (c >= n) break;
				if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
				if (this.keys[c] >= key) break;
				this.keys[i] = this.keys[c];
				this.vals[i] = this.vals[c];
				i = c;
			}
			this.keys[i] = key;
			this.vals[i] = val;
		}
		return top;
	}
}
