import { BackSide, Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';
import { float, uniform } from 'three/tsl';
import { STRICHE } from '../../data/leitstil';
import type { grammatik } from '../leitstil';
import { outlinePosition } from '../surfaces';
import { cutPaper } from './paper-inlay';
import { outlineExpansion, outlinePositionAtOffset, type GlazeContour } from './structure-outline';

/** Owns silhouette and offset-paper resources for illustrated plates. */
export function plateContours() {
	const ink = new Color();
	const glaze: GlazeContour = { ink };
	const paper = uniform(new Color());
	const shadow = uniform(new Color());
	const cut = cutPaper(paper, shadow);
	const outlinePx = uniform(STRICHE.kontur * outlineExpansion);
	const sheetOffsetM = uniform(0);
	const pencilPx = uniform(STRICHE.bestand / 2);
	const pencil = new MeshBasicNodeMaterial({ side: BackSide });
	pencil.vertexNode = outlinePosition(pencilPx);
	const hull = new MeshBasicNodeMaterial({ side: BackSide });
	hull.vertexNode = outlinePositionAtOffset(outlinePx);
	const print = new MeshBasicNodeMaterial({ side: BackSide });
	print.vertexNode = outlinePositionAtOffset(float(STRICHE.minimumTraeger * outlineExpansion));
	const sheet = new MeshBasicNodeMaterial({
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: Math.ceil(STRICHE.kontur * outlineExpansion * 2 * Math.SQRT2),
		polygonOffsetUnits: 1
	});
	sheet.vertexNode = outlinePositionAtOffset(outlinePx, sheetOffsetM);
	return {
		pencil,
		hull,
		print,
		sheet,
		cut,
		glaze,
		setWidth(pencilWidth: number, outlineWidth: number, scale: number) {
			pencilPx.value = pencilWidth / 2;
			outlinePx.value = outlineWidth * outlineExpansion;
			sheetOffsetM.value = (2 * outlinePx.value) / scale;
		},
		setTones(g: ReturnType<typeof grammatik>) {
			ink.copy(g.ink);
			paper.value.copy(g.paper);
			shadow.value.copy(g.schatten);
			pencil.color.copy(g.blei);
			hull.color.copy(g.kontur);
			sheet.color.copy(g.kontur);
			print.color.copy(g.ink);
		},
		dispose() {
			for (const m of [pencil, hull, print, sheet, cut]) m.dispose();
			glaze.material?.dispose();
		}
	};
}
