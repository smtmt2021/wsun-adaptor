/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { EventEmitter } from 'events';
import * as WDC from '../src/wsun-device-constants';
import { WsunSocket, WsunEventUdp, WsunUDP } from '../src/wsun-interfaces';
import { WsunAdaptorSocket } from '../src/wsun-socket';
import { WsunError, WsunSendingInProgress } from '../src/wsun-errors';

interface WsunSocketSendMock {
  sendDgram: jest.Mock;
  isOnline: jest.Mock;
  deleteSocket: jest.Mock;
  on: jest.Mock;
  removeListener: jest.Mock;
}

function wsunSocketSendMock(): WsunSocketSendMock {
  return {
    sendDgram: jest.fn((msg: Buffer, port: number, address: string) => Promise.resolve()),
    isOnline: jest.fn(() => false),
    deleteSocket: jest.fn((socket: WsunSocket) => { }),
    on: jest.fn((en: WsunEventUdp, listener: (udp: WsunUDP) => void) => { }),
    removeListener: jest.fn((en: WsunEventUdp, listener: (udp: WsunUDP) => void) => { })
  };
}

let mock: WsunSocketSendMock;

describe('WsunSocket.send', () => {
  beforeEach(() => {
    mock = wsunSocketSendMock();
    mock.isOnline.mockReturnValue(true);
    mock.sendDgram.mockResolvedValue(undefined);
  });

  test('throw INVALID_RANGE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf = Buffer.from('Hello world!');
    const address = '1234567890123456';
    const port = 0;
    return expect(socket.send(buf, port, address)).rejects.toMatchSnapshot();
  });

  test('throw INVALID_RANGE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf = Buffer.from('Hello world!');
    const address = '1234567890123456';
    const port = 0x10000;
    return expect(socket.send(buf, port, address)).rejects.toMatchSnapshot();
  });

  test('throw INVALID_ADDRESS', () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf = Buffer.from('Hello world!');
    const port = 1;
    const address = '1234:2345:3456:4567:5678:6789:789A:89gh';
    return expect(socket.send(buf, port, address)).rejects.toMatchSnapshot();
  });

  test('throw TOO_LONG', () => {
    const socket = new WsunAdaptorSocket(mock);
    const port = 1;
    const address = '1234567890123456';
    const buf = Buffer.alloc(WDC.MAX_BUF_SIZE + 1);
    return expect(socket.send(buf, port, address)).rejects.toMatchSnapshot();
  });

  test('throw NOT_ONLINE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf = Buffer.from('Hello world!');
    const port = 1;
    const address = '1234567890123456';
    mock.isOnline.mockReturnValueOnce(false);
    return expect(socket.send(buf, port, address)).rejects.toMatchSnapshot();
  });

  test('throw NO_HANDLE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const port = 1;
    const address = '1234567890123456';
    const buf = Buffer.from('Hello world!');
    const error = new WsunError('wsun: no handle to send a dgram');
    mock.sendDgram.mockImplementationOnce(() => Promise.reject(error));
    return expect(socket.send(buf, port, address)).rejects.toEqual(error);
  });

  test('send successfully', () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf = Buffer.from('Hello world!');
    const port = 1;
    const address = '1234567890123456';
    return socket.send(buf, port, address).then(resp => {
      expect(resp).toEqual(undefined);
      expect(mock.sendDgram.mock.calls.length).toBe(1);
      expect(mock.sendDgram.mock.calls[0][0]).toEqual(buf);
      expect(mock.sendDgram.mock.calls[0][1]).toBe(port);
      expect(mock.sendDgram.mock.calls[0][2]).toBe(address);
    });
  });
});

describe('WsunSocket.bind', () => {
  beforeEach(() => {
    mock = wsunSocketSendMock();
    mock.isOnline.mockReturnValue(true);
    mock.sendDgram.mockResolvedValue(undefined);
  });

  test('throw INVALID_RANGE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const port = 0;
    return expect(socket.bind(port)).rejects.toMatchSnapshot();
  });

  test('throw INVALID_RANGE', () => {
    const socket = new WsunAdaptorSocket(mock);
    const port = 0x10000;
    return expect(socket.bind(port)).rejects.toMatchSnapshot();
  });

  test('bind successfully and bind again', async () => {
    const port = 1;
    const socket = new WsunAdaptorSocket(mock);
    await expect(socket.bind(port)).resolves.toBeUndefined();
    expect(mock.on.mock.calls.length).toBe(1);
    expect(mock.on.mock.calls[0].length).toBe(2);
    expect(mock.on.mock.calls[0][0]).toMatch('rxudp');

    await expect(socket.bind(port)).rejects.toMatchSnapshot();

    await expect(socket.close()).resolves.toBeUndefined();
    expect(mock.removeListener.mock.calls.length).toBe(1);
    expect(mock.removeListener.mock.calls[0].length).toBe(2);
    expect(mock.removeListener.mock.calls[0][0]).toMatch('rxudp');
    expect(typeof mock.removeListener.mock.calls[0][1] === 'function').toBeTruthy();
  });

  test('receive data', done => {
    const remotePort = 1;
    const localPort = 2;
    const socket = new WsunAdaptorSocket(mock);
    const emitter = new EventEmitter();
    const obuf = Buffer.from('Hello world!');
    const oudp = {
      sender: '1234:2345:3456:4567:5678:6789:789A:0001',
      dest: '1234:2345:3456:4567:5678:6789:789A:0002',
      rport: remotePort,
      lport: localPort,
      senderlla: '1122334455667788',
      secured: true,
      datalen: obuf.length,
      data: obuf
    };
    mock.on.mockImplementation((n: string, f: (rudp: WsunUDP) => void) => {
      emitter.on(n, f);
    });
    socket.once('message', (rudp, rinfo) => {
      expect(rudp).toEqual(obuf);
      expect(rinfo).toEqual({
        address: oudp.sender,
        family: 'IPv6',
        port: oudp.lport,
        size: oudp.datalen
      });
      done();
    });
    socket.bind(remotePort).then(() => emitter.emit('rxudp', oudp));
  });

  test('receive no data (port numbers are different)', done => {
    const remotePort = 1;
    const localPort = 2;
    const socket = new WsunAdaptorSocket(mock);
    const emitter = new EventEmitter();
    const obuf = Buffer.from('Hello world!');
    const oudp = {
      sender: '1234:2345:3456:4567:5678:6789:789A:0001',
      dest: '1234:2345:3456:4567:5678:6789:789A:0002',
      rport: remotePort,
      lport: localPort,
      senderlla: '1122334455667788',
      secured: true,
      datalen: obuf.length,
      data: obuf
    };
    mock.on.mockImplementation((n: string, f: (rudp: WsunUDP) => void) => {
      emitter.on(n, f);
    });
    const callback = jest.fn();
    setTimeout(() => {
      socket.removeAllListeners('message');
      expect(callback).not.toBeCalled();
      done();
    }, 1 * 1000);
    socket.once('message', callback);
    socket
      .bind(remotePort + 12345) // listening with different number
      .then(() => emitter.emit('rxudp', oudp));
  });
});

describe('WsunSocket.send 2 packets simultaneously', () => {
  beforeEach(() => {
    mock = wsunSocketSendMock();
    mock.isOnline.mockReturnValue(true);
    mock.sendDgram.mockResolvedValue(undefined);
    mock.sendDgram.mockImplementationOnce(
      () =>
        // for first call
        new Promise<void>(resolve => setTimeout(() => resolve(), 1 * 1000))
    );
    mock.sendDgram.mockImplementationOnce(() =>
      // for secound call
      Promise.reject(new WsunSendingInProgress())
    );
  });

  test('send 2 packets successfully', async () => {
    const socket = new WsunAdaptorSocket(mock);
    const buf1 = Buffer.from('Hello world!');
    const buf2 = Buffer.from('Hello another world!');
    const port = 1;
    const address = '1234567890123456';

    const promise = socket.send(buf1, port, address); // will be resolved after 1 sec.
    await expect(socket.send(buf2, port, address)).resolves.not.toThrow();
    await expect(promise).resolves.not.toThrow();

    expect(mock.sendDgram.mock.calls.length).toBe(3);
    expect(mock.sendDgram.mock.calls[0][0]).toEqual(buf1);
    expect(mock.sendDgram.mock.calls[0][1]).toBe(port);
    expect(mock.sendDgram.mock.calls[0][2]).toBe(address);

    expect(mock.sendDgram.mock.calls[1][0]).toEqual(buf2);
    expect(mock.sendDgram.mock.calls[1][1]).toBe(port);
    expect(mock.sendDgram.mock.calls[1][2]).toBe(address);

    expect(mock.sendDgram.mock.calls[2][0]).toEqual(buf2);
    expect(mock.sendDgram.mock.calls[2][1]).toBe(port);
    expect(mock.sendDgram.mock.calls[2][2]).toBe(address);
  });
});
