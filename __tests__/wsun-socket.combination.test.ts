/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { Bp35a1Robot as Robot, MockBinding, SerialPort } from '@smtmt2021/wsun-adaptor-mock';
import { WsunGetAdaptor, WsunAdaptor } from '../src';

const FAKE_PORT = '/dev/ROBOT';
const FAKE_ID = '0123456789ABCDEF0123456789ABCDEF';
const FAKE_PASSWORD = 'ABDEFGHIJKLM';
const REMOTE_DEVICE_MAC = '123ABC456DEF7890';
const REMOTE_DEVICE_IPV6 = 'FE80:0000:0000:0000:103A:BC45:6DEF:7890';
const MY_DEVICE_IPV6 = '2001:0DB8:0000:0000:0000:0000:0000:0001';

SerialPort.Binding = Robot;
MockBinding.createPort(FAKE_PORT, { echo: false, record: true });

let wsAdaptor: WsunAdaptor;

function sleep(msec: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, msec));
}

describe('WiSunAdaptor', () => {
  beforeAll(async () => {
    console.error = function () {
      // disable annoying error message
    };
    jest.setTimeout(10 * 1000);
    wsAdaptor = WsunGetAdaptor('BP35A1', {
      device: FAKE_PORT
    }) as WsunAdaptor;
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
    Robot.instance.failJoin = false;
    Robot.instance.termReplyEvent28 = false;
    Robot.instance.termFailEr10 = false;
    Robot.instance.udpRetryCount = 0;
    Robot.instance.lookupTable = {};
    Robot.instance.lookupTable[REMOTE_DEVICE_MAC] = REMOTE_DEVICE_IPV6;
  });

  test('open adaptor successfully', () => {
    const wsid = {
      id: FAKE_ID,
      password: FAKE_PASSWORD
    };
    expect(wsAdaptor.isOnline()).toBeFalsy();
    return wsAdaptor.open(wsid).then(pandesc => {
      expect(wsAdaptor.isOnline()).toBeTruthy();
      expect(Robot.instance.panDescriptor).toEqual(pandesc);
      expect(Robot.instance.panDescriptor.channel).toBe(Robot.instance.reg.S02);
      expect(Robot.instance.panDescriptor.panId).toBe(Robot.instance.reg.S03);
      expect(Robot.instance.rbid).toBe(wsid.id);
      expect(Robot.instance.password).toBe(wsid.password);
      expect(Robot.instance.reg.SFE).toBe(0);
      expect(Robot.instance.opt).toBe(1);
    });
  });

  test('send data', async () => {
    const socket = wsAdaptor.createSocket();
    const data = Buffer.from('this is a test data#1');
    const port = 3610;
    const dest = REMOTE_DEVICE_IPV6;
    await expect(socket.send(data, port, dest)).resolves.not.toThrow();
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
    await expect(socket.close()).resolves.not.toThrow();
  });

  test('send data to mac', async () => {
    const socket = wsAdaptor.createSocket();
    const data = Buffer.from('this is a test data#2');
    const port = 3610;
    const dest = REMOTE_DEVICE_MAC;
    await expect(socket.send(data, port, dest)).resolves.not.toThrow();
    expect(Robot.instance.udps.length).toBe(1);
    expect(Robot.instance.udps[0].data).toEqual(data);
    expect(Robot.instance.udps[0].ipaddr).toBe(REMOTE_DEVICE_IPV6);
    expect(Robot.instance.udps[0].port).toBe(port);
    await expect(socket.close()).resolves.not.toThrow();
  });

  test('receive data', done => {
    const socket = wsAdaptor.createSocket();
    const dest = MY_DEVICE_IPV6;
    const rport = 3610;
    const lport = 1000;
    const data = Buffer.from('this is a test data#3');
    socket.once('message', (msg: Buffer, rinfo) => {
      expect(msg).toEqual(data);
      expect(rinfo.address).toBe(Robot.instance.ipv6);
      expect(rinfo.family).toBe('IPv6');
      expect(rinfo.port).toBe(lport);
      expect(rinfo.size).toBe(data.length);
      socket.close();
      done();
    });
    socket.bind(rport).then(() => Robot.instance.sendBack(dest, rport, lport, data));
  });

  test('receive data and close the socket', done => {
    const socket = wsAdaptor.createSocket();
    const dest = MY_DEVICE_IPV6;
    const rport = 3610;
    const lport = 1000;
    const data = Buffer.from('this is a test data#4');
    socket.once('message', (msg: Buffer, rinfo) => {
      expect(msg).toEqual(data);
      expect(rinfo.address).toBe(Robot.instance.ipv6);
      expect(rinfo.family).toBe('IPv6');
      expect(rinfo.port).toBe(lport);
      expect(rinfo.size).toBe(data.length);
      socket.close().then(() => done());
    });
    socket.bind(rport).then(() => Robot.instance.sendBack(dest, rport, lport, data));
  });

  test('close adaptor', async () => {
    await expect(wsAdaptor.close()).resolves.not.toThrow();
    expect(wsAdaptor.isOnline()).toBeFalsy();
  });
});
