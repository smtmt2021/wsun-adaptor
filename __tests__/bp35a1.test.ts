/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { Bp35a1Robot as Robot, MockBinding, SerialPort } from '@smtmt2021/wsun-adaptor-mock';
import { WsunGetAdaptor, WsunAdaptor, WsunSocket } from '../src';
import { WsunAdaptorInternal } from '../src/wsun-interfaces';

type WsunAdaptorTest = WsunAdaptor &
  WsunAdaptorInternal & {
    getHandle(port: number): { found: boolean; handle?: number };
    getAsciiMode(): Promise<boolean>;
    setPanId(id: number): Promise<void>;
    setPwd(pwd: string): Promise<void>;
    setId(id: string): Promise<void>;
    setNeighbor(mac: string, ipv6: string): Promise<void>;
    setChannelNumber(channel: number): Promise<void>;
    lookup(mac: string): Promise<string>;
    join(target: string, channel: number, panId: number): Promise<void>;
    sendDgram(msg: Buffer, port: number, address: string): Promise<void>;
    readPortMapTable(): Promise<void>;
    portmap: number[];
    outstandingSockets: WsunSocket[];
  };

const FAKE_PORT = '/dev/ROBOT';
const FAKE_ID = '0123456789ABCDEF0123456789ABCDEF';
const FAKE_PASSWORD = 'ABDEFGHIJKLM';
const REMOTE_DEVICE_MAC = '123ABC456DEF7890';
const REMOTE_DEVICE_IPV6 = 'FE80:0000:0000:0000:103A:BC45:6DEF:7890';

SerialPort.Binding = Robot;
MockBinding.createPort(FAKE_PORT, { echo: false, record: true });

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

  test('open successfully', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    return wsAdaptor.open(wsid).then(pandesc => {
      expect(wsAdaptor.isOnline()).toBe(true);
      expect(Robot.instance.panDescriptor).toEqual(pandesc);
      expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
      expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
      expect(Robot.instance.rbid).toBe(wsid.id);
      expect(Robot.instance.password).toBe(wsid.password);
      expect(Robot.instance.ports).toEqual(wsAdaptor.portmap);
      expect(Robot.instance.reg.SFE).toBe(0);
      expect(Robot.instance.opt).toBe(1);
    });
  });

  test('check functions', async () => {
    await expect(wsAdaptor.join('0123456789ABCDEFG', 0x21, 0)).rejects.toMatchSnapshot();
    await expect(wsAdaptor.join('0123456789ABCDEF', 0x20, 0)).rejects.toMatchSnapshot();
    await expect(wsAdaptor.join('0123456789ABCDEF', 0x21, 0x10000)).rejects.toMatchSnapshot();

    Robot.instance.noOkParam = true;
    await expect(wsAdaptor.getAsciiMode()).rejects.toMatchSnapshot();

    Robot.instance.noCommandReply = true;
    await expect(wsAdaptor.readPortMapTable()).rejects.toMatchSnapshot();
  });

  test('create & delete a socket', () => {
    const socket = wsAdaptor.createSocket();
    expect(wsAdaptor.outstandingSockets).toEqual([socket]);
    wsAdaptor.deleteSocket(socket);
    expect(wsAdaptor.outstandingSockets).toEqual([]);
  });

  test('close WSun adaptor', async () => {
    const socket = wsAdaptor.createSocket();
    expect(wsAdaptor.outstandingSockets).toEqual([socket]);
    expect(wsAdaptor.isOnline()).toBeTruthy();
    await expect(wsAdaptor.close()).resolves.not.toThrow();
    expect(wsAdaptor.isOnline()).toBeFalsy();
    expect(wsAdaptor.outstandingSockets).toEqual([]);
  });
});
