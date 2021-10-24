/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { Bp35a1Robot as Robot, MockBinding, SerialPort } from '@smtmt2021/wsun-adaptor-mock';
import { WsunGetAdaptor, WsunAdaptor } from '../src';
import * as WDC from '../src/wsun-device-constants';
import { WsunUDP, WsunAdaptorInternal } from '../src/wsun-interfaces';

const FAKE_PORT = '/dev/ROBOT';
const FAKE_ID = '0123456789ABCDEF0123456789ABCDEF';
const FAKE_PASSWORD = 'ABDEFGHIJKLM';
const REMOTE_DEVICE_MAC = '123ABC456DEF7890';
const REMOTE_DEVICE2_MAC = '123ABC456DEF7892';
const REMOTE_DEVICE_IPV6 = 'FE80:0000:0000:0000:103A:BC45:6DEF:7890';
const REMOTE_DEVICE2_IPV6 = 'FE80:0000:0000:0000:103A:BC45:6DEF:7892';
const MY_DEVICE_IPV6 = '2001:0DB8:0000:0000:0000:0000:0000:0001';

SerialPort.Binding = Robot;
MockBinding.createPort(FAKE_PORT, { echo: false, record: true });

type WsunAdaptorTest = WsunAdaptor & WsunAdaptorInternal;
let wsAdaptor: WsunAdaptorTest;

function sleep(msec: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, msec));
}

describe('WSunAdaptor', () => {
  beforeAll(async () => {
    console.error = function () {
      // disable annoying error message
    };
    jest.setTimeout(10 * 1000);
    wsAdaptor = WsunGetAdaptor('BP35A1', {
      device: FAKE_PORT
    }) as WsunAdaptorTest;
    Robot.instance.panDescriptor.addr = REMOTE_DEVICE_MAC;
    Robot.instance.ipv6 = REMOTE_DEVICE_IPV6;
    await sleep(1);
  });

  beforeEach(() => {
    Robot.instance.udps = [];
    Robot.instance.noCommandReply = false;
    Robot.instance.noScanReply = false;
    Robot.instance.noScanDevice = false;
    Robot.instance.noJoinReply = false;
    Robot.instance.noTermReply = false;
    Robot.instance.noLookupReply = false;
    Robot.instance.noOkParam = false;
    Robot.instance.failJoin = false;
    Robot.instance.termReplyEvent28 = false;
    Robot.instance.termFailEr10 = false;
    Robot.instance.udpRetryCount = 0;
    Robot.instance.lookupTable = {};
    Robot.instance.lookupTable[REMOTE_DEVICE_MAC] = REMOTE_DEVICE_IPV6;
  });

  test('open failed due to invalid id', () => {
    const wsid = {
      id: FAKE_ID + 'ABC',
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open failed due to invalid password', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD + '123456789012345678901234567890123456789'
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open failed due to invalid cache', async () => {
    await expect(
      wsAdaptor.open(
        {
          id: FAKE_ID,
          password: FAKE_PASSWORD
        },
        {
          channel: 0, // <<<
          panId: 1,
          addr: '0011223344556677'
        }
      )
    ).rejects.toMatchSnapshot();

    await expect(
      wsAdaptor.open(
        {
          id: FAKE_ID,
          password: FAKE_PASSWORD
        },
        {
          channel: 33,
          panId: 0x10000, // <<<
          addr: '0011223344556677'
        }
      )
    ).rejects.toMatchSnapshot();

    await expect(
      wsAdaptor.open(
        {
          id: FAKE_ID,
          password: FAKE_PASSWORD
        },
        {
          channel: 33,
          panId: 1,
          addr: '00112233445566GG' // <<<<
        }
      )
    ).rejects.toMatchSnapshot();
  });

  test('open throw SEND TIMEOUT', () => {
    Robot.instance.noCommandReply = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open failed due to no scan complete event', () => {
    Robot.instance.noScanReply = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open failed due to no device while scanning', () => {
    Robot.instance.noScanDevice = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).resolves.toBeUndefined();
  });

  test('open failed due to no join device', () => {
    Robot.instance.noJoinReply = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open failed due to event24', () => {
    Robot.instance.failJoin = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).resolves.toBeUndefined();
  });

  test('open failed due to lookup', () => {
    Robot.instance.noLookupReply = true;
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('open successfully', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    const sessionEstablished = jest.fn();
    wsAdaptor.on('session-established', sessionEstablished);

    return wsAdaptor.open(wsid).then(pandesc => {
      expect(wsAdaptor.isOnline()).toBe(true);
      expect(Robot.instance.panDescriptor).toEqual(pandesc);
      expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
      expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
      expect(Robot.instance.rbid).toBe(wsid.id);
      expect(Robot.instance.password).toBe(wsid.password);
      expect(Robot.instance.reg.SFE).toBe(0);
      expect(Robot.instance.opt).toBe(1);
      expect(sessionEstablished).toHaveBeenCalled();
      // wsAdaptor.removeAllListeners('session-established');
    });
  });

  test('re-open throw INVALD STATE', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return expect(wsAdaptor.open(wsid)).rejects.toMatchSnapshot();
  });

  test('send data', async () => {
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await expect(wsAdaptor.sendDgram(data, port, dest)).resolves.not.toThrow();
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('send data to mac', async () => {
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_MAC;
    await expect(wsAdaptor.sendDgram(data, port, dest)).resolves.not.toThrow();
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('send data to invalid port', async () => {
    const data = Buffer.from('01234567890123456789');
    const port = 0x10000;
    const dest = REMOTE_DEVICE_IPV6;
    await expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
  });

  test('send large data', () => {
    const data = Buffer.alloc(WDC.MAX_DGRAM_SIZE + 1);
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    return expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
  });

  test('send data to invalid address', () => {
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = '0123456789ABCDEG';
    return expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
  });

  test('send data (retry: 1)', async () => {
    Robot.instance.udpRetryCount = 1;
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await wsAdaptor.sendDgram(data, port, dest);
    expect(Robot.instance.udpRetryCount).toBe(0);
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('send data (retry: 2)', async () => {
    Robot.instance.udpRetryCount = 2;
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await wsAdaptor.sendDgram(data, port, dest);
    expect(Robot.instance.udpRetryCount).toBe(0);
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('send data (retry: 3)', async () => {
    Robot.instance.udpRetryCount = 3;
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await wsAdaptor.sendDgram(data, port, dest);
    expect(Robot.instance.udpRetryCount).toBe(0);
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('send data (retry: 4)', async () => {
    Robot.instance.udpRetryCount = 4;
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
    expect(Robot.instance.udpRetryCount).toBe(0);
  });

  test('send data (no handle to send)', async () => {
    const data = Buffer.from('01234567890123456789');
    const port = 1000;
    const dest = REMOTE_DEVICE_IPV6;
    await expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
  });

  test('send data simultaneously to make an exception', async () => {
    const buf1 = Buffer.from('this is a test#1');
    const buf2 = Buffer.from('this is a test#2');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    const promise = wsAdaptor.sendDgram(buf1, port, dest);
    await expect(wsAdaptor.sendDgram(buf2, port, dest)).rejects.toMatchSnapshot();
    await expect(promise).resolves.not.toThrow();
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(buf1);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
  });

  test('receive data', done => {
    const dest = MY_DEVICE_IPV6;
    const rport = 3610;
    const lport = 1000;
    const data = Buffer.from('this is a test data');
    wsAdaptor.on('rxudp', (udp: WsunUDP) => {
      expect(udp.data).toEqual(data);
      expect(udp.datalen).toBe(data.length);
      expect(udp.sender).toBe(Robot.instance.ipv6);
      expect(udp.senderlla).toBe(REMOTE_DEVICE_MAC);
      expect(udp.dest).toBe(dest);
      expect(udp.lport).toBe(lport);
      expect(udp.rport).toBe(rport);
      expect(udp.secured).toBeTruthy();
      done();
    });
    Robot.instance.sendBack(dest, rport, lport, data);
  });

  test('fire session events', async () => {
    const sessionTimeout = jest.fn();
    wsAdaptor.on('session-timeout', sessionTimeout);
    Robot.instance.issueEvent(0x29);
    await sleep(100);
    expect(sessionTimeout).toHaveBeenCalled();

    const session108start = jest.fn();
    wsAdaptor.on('session-108-start', session108start);
    Robot.instance.issueEvent(0x32);
    await sleep(100);
    expect(session108start).toHaveBeenCalled();

    const session108end = jest.fn();
    wsAdaptor.on('session-108-end', session108end);
    Robot.instance.issueEvent(0x33);
    await sleep(100);
    expect(session108end).toHaveBeenCalled();
  });

  test('close WSun adaptor', async () => {
    const sessionEnded = jest.fn();
    wsAdaptor.on('session-ended', sessionEnded);

    await expect(wsAdaptor.close()).resolves.not.toThrow();
    expect(sessionEnded).toHaveBeenCalled();
    // wsAdaptor.removeAllListeners('session-ended');
  });

  test('close WSun adaptor, again', () => {
    return expect(wsAdaptor.close()).resolves.not.toThrow();
  });

  test('send data when not online', () => {
    const data = Buffer.from('01234567890123456789');
    const port = 3610;
    const dest = '0123456789ABCDEF';
    return expect(wsAdaptor.sendDgram(data, port, dest)).rejects.toMatchSnapshot();
  });

  test('open with cached descriptor successfully, and close successfully', async () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    const cache = {
      channel: 59,
      panId: 4068,
      addr: REMOTE_DEVICE2_MAC
    };
    const pandesc = await wsAdaptor.open(wsid, cache);
    expect(pandesc != null).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(pandesc!.channel).toEqual(cache.channel);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(pandesc!.panId).toEqual(cache.panId);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(pandesc!.addr).toEqual(cache.addr);
    expect(wsAdaptor.isOnline()).toBe(true);
    expect(cache.channel).toBe(Robot.instance.reg.S02);
    expect(cache.panId).toBe(Robot.instance.reg.S03);
    expect(Robot.instance.rbid).toBe(wsid.id);
    expect(Robot.instance.password).toBe(wsid.password);
    expect(Robot.instance.reg.SFE).toBe(0);
    expect(Robot.instance.opt).toBe(1);
    expect(Robot.instance.lookupTable[REMOTE_DEVICE2_MAC]).toBe(REMOTE_DEVICE2_IPV6);

    await expect(wsAdaptor.close()).resolves.not.toThrow();
  });

  test('open successfully, and close successfully by event28', async () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    const pandesc = await wsAdaptor.open(wsid);
    expect(pandesc != null).toBeTruthy();
    expect(wsAdaptor.isOnline()).toBe(true);
    expect(Robot.instance.panDescriptor).toEqual(pandesc);
    expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
    expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
    expect(Robot.instance.rbid).toBe(wsid.id);
    expect(Robot.instance.password).toBe(wsid.password);
    expect(Robot.instance.reg.SFE).toBe(0);
    expect(Robot.instance.opt).toBe(1);

    Robot.instance.termReplyEvent28 = true;
    await expect(wsAdaptor.close()).resolves.not.toThrow();
  });

  test('open successfully, get event26, and close successfully', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return wsAdaptor
      .open(wsid)
      .then(pandesc => {
        expect(pandesc != null).toBeTruthy();
        expect(wsAdaptor.isOnline()).toBe(true);
        expect(Robot.instance.panDescriptor).toEqual(pandesc);
        expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
        expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
        expect(Robot.instance.rbid).toBe(wsid.id);
        expect(Robot.instance.password).toBe(wsid.password);
        expect(Robot.instance.reg.SFE).toBe(0);
        expect(Robot.instance.opt).toBe(1);
      })
      .then(() => {
        return new Promise<void>(resolve => {
          wsAdaptor.on('session-ending', resolve);
          Robot.instance.issueEvent(0x26);
        });
      })
      .then(() => expect(wsAdaptor.close()).resolves.not.toThrow())
      .then(() => expect(wsAdaptor.isOnline()).toBeFalsy());
  });

  test('open successfully, and close erroneously due to term-timeout', async () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    const pandesc = await wsAdaptor.open(wsid);
    expect(pandesc != null).toBeTruthy();
    expect(Robot.instance.panDescriptor).toEqual(pandesc);
    expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
    expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
    expect(Robot.instance.rbid).toBe(wsid.id);
    expect(Robot.instance.password).toBe(wsid.password);
    expect(Robot.instance.reg.SFE).toBe(0);
    expect(Robot.instance.opt).toBe(1);

    Robot.instance.noTermReply = true;
    await expect(wsAdaptor.close()).resolves.toBeUndefined();
  });

  test('open successfully, and close erroneously due to fail er10', async () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    const pandesc = await wsAdaptor.open(wsid);
    expect(pandesc != null).toBeTruthy();
    expect(Robot.instance.panDescriptor).toEqual(pandesc);
    expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
    expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
    expect(Robot.instance.rbid).toBe(wsid.id);
    expect(Robot.instance.password).toBe(wsid.password);
    expect(Robot.instance.reg.SFE).toBe(0);
    expect(Robot.instance.opt).toBe(1);

    Robot.instance.termFailEr10 = true;
    await expect(wsAdaptor.close()).resolves.toBeUndefined();
  });
});
