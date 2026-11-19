/** Stable instance-buffer codes for analytic architectural prints. */
export const printPatterns = {
	'print-plain': 0,
	'print-stripes': 1,
	'print-bands': 2,
	'print-dots': 3,
	'print-grid': 4,
	'print-checker': 5,
	'print-diagonal': 6,
	'print-windows': 7,
	'print-triangles': 8,
	'print-granules': 9,
	'print-zigzag': 10,
	'print-porthole': 11,
	'print-arch': 12
} as const;
export type PrintPattern = keyof typeof printPatterns;
export type PrintFinish = PrintPattern | 'print-terrazzo' | 'halftone' | 'fired-slip';
