import type { Manifold, ManifoldToplevel, Vec3 } from 'manifold-3d';
/** Owns native temporaries for one synchronous operation, including failed constructions. */
export function withSolids<T>(kernel: ManifoldToplevel, run: (s: Solids) => T): T {
	const owned: { delete(): void }[] = [];
	const keep = <V extends { delete(): void }>(value: V) => {
		owned.push(value);
		return value;
	};
	try {
		return run({ kernel, keep });
	} finally {
		for (const value of owned.reverse()) value.delete();
	}
}
export type Solids = {
	kernel: ManifoldToplevel;
	keep: <V extends { delete(): void }>(value: V) => V;
};
/** Keeps the half-space normal · point >= constant. Manifold measures offset along a unit normal. */
export function clip(s: Solids, body: Manifold, normal: Vec3, constant: number) {
	return s.keep(body.trimByPlane(normal, constant / Math.hypot(...normal)));
}
