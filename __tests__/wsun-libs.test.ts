/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import * as Lib from '../src/wsun-libs';

test.each([
  ['0123456789ABCDEF', true],
  ['0123456789ABCDEG', false],
  ['0123456789ABCDEFG', false],
  ['0123456789ABCDE', false]
])('MAC %s', (a, expected) => {
  expect(Lib.isMac.test(a)).toBe(expected);
});

test.each([
  ['0000:0000:0000:0000:0000:0000:0000:0000', true],
  ['0:0000:0000:0000:0000:0000:0000:0000', true],
  ['0001:0000:0000:0000:0000:0000:0000:000F', true],
  ['0000:0000:0000:0000:0000:0000:0000:F', true],
  ['0000:0000:0000:0000:0000:0000:0000:0000:0000', false],
  ['0000:0000:0000:0000:0000:0000:0000:000G', false],
  ['0000:0000:0000:0000:0000:0000:0000', false]
])('IPV6 %s', (a, expected) => {
  expect(Lib.isIPv6.test(a)).toBe(expected);
});

test.each([
  [1, 1, '01'],
  [1, 2, '0001'],
  [0x12, 3, '000012'],
  [0x1234, 4, '00001234'],
  [0x123456, 5, '0000123456'],
  [0x123456789, 6, '000123456789'],
  [0x123456789abc, 7, '00123456789ABC'],
  [0x1fffffffffffff, 8, '001FFFFFFFFFFFFF']
])('num2hex(%i, %i)', (a, b, expected) => {
  expect(Lib.num2hex(a, b)).toBe(expected);
});

test('num2hex', () => {
  expect(Lib.num2hex(1)).toBe('0001');
  expect(() => {
    Lib.num2hex(Number.MAX_SAFE_INTEGER + 1, 8);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    Lib.num2hex(0, 0);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    Lib.num2hex(0, 9);
  }).toThrowErrorMatchingSnapshot();
});

test.each([
  [1, 0],
  [20, 0],
  [40, 1],
  [80, 2],
  [160, 3],
  [320, 4],
  [640, 5],
  [1280, 6],
  [2560, 7],
  [5120, 8],
  [10240, 9],
  [20480, 10],
  [40960, 11],
  [81920, 12],
  [163840, 13],
  [327680, 14],
  [655360, 14]
])('msec2duration(%i)', (msec, expected) => {
  expect(Lib.msec2duration(msec)).toBe(expected);
});

test.each([
  [0, 20],
  [1, 40],
  [2, 80],
  [3, 160],
  [4, 320],
  [5, 640],
  [6, 1280],
  [7, 2560],
  [8, 5120],
  [9, 10240],
  [10, 20480],
  [11, 40960],
  [12, 81920],
  [13, 163840],
  [14, 327680]
])('duration2msec(%i) => %i', (x, expected) => {
  expect(Lib.duration2msec(x)).toBe(expected);
});

test.each([
  [
    {
      channel: 33,
      panId: 0,
      addr: '0123456789abcdef'
    },
    true
  ],
  [
    {
      channel: 60,
      panId: 0,
      addr: '0123456789abcdef'
    },
    true
  ],
  [
    {
      channel: 33,
      panId: 0xffff,
      addr: '0123456789abcdef'
    },
    true
  ],
  [
    {
      channel: 32, // <<<
      panId: 0,
      addr: '0123456789abcdef'
    },
    false
  ],
  [
    {
      channel: 61, // <<<
      panId: 0,
      addr: '0123456789abcdef'
    },
    false
  ],
  [
    {
      channel: 33,
      panId: -1, // <<<
      addr: '0123456789abcdef'
    },
    false
  ],
  [
    {
      channel: 33,
      panId: 0x10000, // <<<
      addr: '0123456789abcdef'
    },
    false
  ],
  [
    {
      channel: 33,
      panId: 0,
      addr: '0123456789abcdef0' // <<<
    },
    false
  ],
  [
    {
      channel: 33,
      panId: 0,
      addr: '0123456789abcde' // <<<
    },
    false
  ]
])('isValidCache(%s)', (x, expected) => {
  expect(Lib.isValidCache(x)).toBe(expected);
});
