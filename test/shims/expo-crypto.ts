import { randomUUID as r, getRandomValues } from 'node:crypto';
export const randomUUID = () => r();
export const getRandomBytes = (n: number) => getRandomValues(new Uint8Array(n));
