import { trimBay, type BaySurvey } from '../../logic/megastructure';

self.onmessage = ({ data }: MessageEvent<BaySurvey>) => {
	const start = performance.now();
	const result = trimBay(data);
	self.postMessage({ id: data.id, result, milliseconds: performance.now() - start });
};
