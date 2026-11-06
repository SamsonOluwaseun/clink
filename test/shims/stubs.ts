// Stand-ins for phone-only modules that the tested code imports but the tests never call
export const createAudioPlayer = () => ({ seekTo: async () => {}, play: () => {} });
export const getDocumentAsync = async () => ({ canceled: true, assets: null });
export const shareAsync = async () => {};
export const isAvailableAsync = async () => false;
export class File { constructor(..._: unknown[]) {} }
export const Paths = { cache: '', document: '' };
export const RecordingPresets = { HIGH_QUALITY: {}, LOW_QUALITY: {} };
