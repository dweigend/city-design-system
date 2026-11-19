/** A facing outline in a socket's vertical section, measured from the fitting axis in metres. */
type ProfileSection = { height: number; reach: number };
type Contact = { offset: number; height: number; segment: number; fraction: number };

/** First horizontal contact of a round host with a piecewise-linear guest outline.
 * Heights are relative to the common seat. The host radius is in metres; its centre is at that radius.
 * The witness identifies a point on the actual segment, including contact between sampled sections. */
export function roundProfileContact(
	radius: number,
	sections: readonly ProfileSection[]
): Contact | undefined {
	if (!Number.isFinite(radius) || radius <= 0)
		throw new RangeError('Expected a positive host radius');
	let best: Contact | undefined;
	for (let i = 1; i < sections.length; i++) {
		const a = sections[i - 1],
			b = sections[i],
			dh = b.height - a.height;
		if (!(dh > 0) || ![a.height, b.height, a.reach, b.reach].every(Number.isFinite))
			throw new RangeError('Expected finite sections with increasing heights');
		const low = Math.max(0, a.height),
			high = Math.min(2 * radius, b.height);
		if (high < low) continue;
		const slope = (b.reach - a.reach) / dh;
		const stationary = radius * (1 + slope / Math.hypot(1, slope));
		const h = Math.max(low, Math.min(high, stationary)),
			fraction = (h - a.height) / dh;
		const offset = Math.sqrt(h * (2 * radius - h)) + a.reach + (b.reach - a.reach) * fraction;
		if (!best || offset > best.offset) best = { offset, height: h, segment: i - 1, fraction };
	}
	return best;
}

/** Centre separation of two circular sections resting on a common tangent, in metres. */
export function roundPairContact(hostRadius: number, guestRadius: number) {
	if (![hostRadius, guestRadius].every((r) => Number.isFinite(r) && r > 0))
		throw new RangeError('Expected positive section radii');
	return 2 * Math.sqrt(hostRadius * guestRadius);
}
