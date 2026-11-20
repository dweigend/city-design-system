import type { Node } from 'three/webgpu';

export type Muster = {
	farbe: Node<'vec3'>;
	hoehe: Node<'float'>;
	relief: number;
	reliefCoverage?: Node<'float'>;
	rauheitVersatz?: Node<'float'>;
	metallVersatz?: Node<'float'>;
	licht?: Node<'vec3'>;
};

export type MusterRaum = {
	lokal: Node<'vec3'>;
	welt: Node<'vec3'>;
};
