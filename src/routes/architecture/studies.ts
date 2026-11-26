import type { Display, ViewFit } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';

type Measurement = Readonly<{ label: string; value: string; unit: string }>;
type Study = Readonly<{ drawables: readonly Drawable[]; measurements: readonly Measurement[] }>;
export type StudyPainter = (display: Display) => Study;

type StudySheet = Readonly<{
	label: string;
	fit: ViewFit;
	load: () => Promise<StudyPainter>;
}>;

const isometric = { bearing: Math.PI / 7, elevation: Math.PI / 6, fill: 0.9 };

export const studies = {
	docking: {
		label: 'Face docking',
		fit: { bearing: Math.PI / 5, elevation: Math.PI / 8, fill: 0.86 },
		load: async () => {
			const { buildStudy } = await import('./dock-study/study');
			const result = buildStudy('antiprism');
			const study = {
				drawables: result.drawables,
				measurements: [
					{ label: 'Docked modules', value: String(result.docked), unit: '' },
					{ label: 'Socket collars', value: String(result.joints), unit: '' }
				]
			};
			return () => study;
		}
	},
	frame: {
		label: 'Supported frame',
		fit: isometric,
		load: async () => {
			const { frameSheet } = await import('./frame-sheet');
			const study = frameSheet();
			return () => study;
		}
	},
	tubes: {
		label: 'Elevated tubes',
		fit: isometric,
		load: async () => {
			const { tubesSheet } = await import('./tubes-sheet');
			const paint = tubesSheet();
			return (display: Display) => paint(display === 'transparency' ? display : 'normal');
		}
	},
	envelope: {
		label: 'Spanned envelope',
		fit: { ...isometric, bearing: Math.PI / 9, elevation: Math.PI / 5 },
		load: async () => {
			const { envelopeSheet } = await import('./envelope-sheet');
			const study = envelopeSheet();
			return () => study;
		}
	}
} as const satisfies Record<string, StudySheet>;

export function readStudy(name: string): StudySheet | undefined {
	return Object.hasOwn(studies, name) ? studies[name as keyof typeof studies] : undefined;
}
