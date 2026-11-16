/** A value the contract guarantees; if it is missing, that is a named program error. */
export function muss<T>(wert: T | undefined | null, was: string): T {
	if (wert === undefined || wert === null) throw new Error(`Missing: ${was}`);
	return wert;
}
