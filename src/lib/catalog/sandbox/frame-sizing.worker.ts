import { sizeFrameSites } from '../logic/sandbox';

/** One immutable survey in, one batch of surveyed members with drawing sections out. */
self.onmessage = ({ data }: MessageEvent<Parameters<typeof sizeFrameSites>[0]>) => {
	self.postMessage(sizeFrameSites(data));
};
