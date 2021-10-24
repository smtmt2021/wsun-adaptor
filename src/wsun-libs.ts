/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunCache } from './wsun-interfaces';

export const isParamOfPanDesc = /^ {2}[A-Za-z0-9 ]+:[A-Fa-f0-9]+$/;
export const isNumber = /^\d+$/;
export const isMac = /^[0-9A-Fa-f]{16}$/;
export const isIPv6 = /^[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+$/;

/**
 *  Convert number to hex-decimal string.
 *  @param n     to be converted.
 *  @param bytes number of bytes, e.g. 2 bytes means 4 digits.
 */
export function num2hex(n: number, bytes = 2): string {
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new Error(`the specified number is too large, ${n}`);
  }
  if (bytes < 1 || bytes > 8) {
    throw new TypeError(`invalid size of bytes, $${bytes}`);
  }
  return n
    .toString(16)
    .toUpperCase()
    .padStart(bytes * 2, '0');
}

export function msec2duration(msec: number): number {
  msec = Math.max(msec, 20);
  const duration = Math.floor(Math.log2(msec / 10) - 1);
  return Math.min(duration, 14);
}

export function duration2msec(duration: number): number {
  return Math.pow(2, duration + 1) * 10;
}

export function isValidCache(cache: WsunCache): boolean {
  if (cache.channel < 33 || cache.channel > 60) {
    return false;
  }
  if (cache.panId < 0 || cache.panId > 0xffff) {
    return false;
  }
  if (!isMac.test(cache.addr)) {
    return false;
  }
  return true;
}
