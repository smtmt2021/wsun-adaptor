/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunGetAdaptor, NameOfClass } from '../src';
import { WsunBp35a1 } from '../src/wsun-bp35a1';

const FAKE_PORT = '/dev/ROBOT';

console.error = function () {
  // disable annoying error message
};

describe('WsunGetAdaptor', () => {
  test('cannot make an instance due to serial port', () => {
    const config = { device: '' };
    expect(() => WsunGetAdaptor('BP35A1', config)).toThrowErrorMatchingSnapshot();
  });

  test('must be object factory', () => {
    const adaptor1 = WsunGetAdaptor('unknown' as NameOfClass, {
      device: FAKE_PORT
    });
    expect(adaptor1).toBeUndefined();

    const adaptor2 = WsunGetAdaptor('BP35A1', {
      device: FAKE_PORT
    });
    expect(adaptor2).toBeInstanceOf(WsunBp35a1);

    const adaptor3 = WsunGetAdaptor('BP35A1', {
      device: FAKE_PORT
    });
    expect(adaptor3).toBeInstanceOf(WsunBp35a1);
    expect(adaptor2).toEqual(adaptor3);
  });
});
