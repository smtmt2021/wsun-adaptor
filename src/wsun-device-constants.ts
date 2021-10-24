/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
export const MAX_BUF_SIZE = 1024;
export const MAX_DGRAM_SIZE = 1024;

const isTesting = process.env.NODE_ENV === 'test';
export const COMMAND_TIMEOUT = (isTesting ? 1 : 3) * 1000; // msec
export const SEND_TIMEOUT = (isTesting ? 1 : 10) * 1000; // msec
export const TERM_TIMEOUT = (isTesting ? 1 : 10) * 1000; // msec
export const SCAN_TIMEOUT = (isTesting ? 1 : 60) * 1000; // msec
export const CONNECTION_TIMEOUT = (isTesting ? 1 : 60) * 1000; // msec
