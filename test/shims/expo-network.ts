export const NetworkStateType = { WIFI: 'WIFI', ETHERNET: 'ETHERNET', NONE: 'NONE' };
export async function getIpAddressAsync() { return (globalThis as any).__MY_IP; }
export async function getNetworkStateAsync() { return { type: 'WIFI' }; }
