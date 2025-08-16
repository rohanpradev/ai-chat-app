export function getChangedFields<T extends object>(original: T, updated: Partial<T>): Partial<T> {
	const changed: Partial<T> = {};
	for (const key in updated) {
		if (updated[key] !== original[key]) {
			changed[key] = updated[key];
		}
	}
	return changed;
}
