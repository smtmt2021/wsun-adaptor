/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunGetAdaptor, WsunSocket, WsunCache } from '../src';

const config = {
  device: process.env.WSDEV || ''
};
const wsid = {
  id: process.env.WSID || '',
  password: process.env.WSPWD || ''
};
const cache = process.env.WSDESC ? JSON.parse(process.env.WSDESC) as WsunCache : undefined;

const DEVICE_NAME = 'BP35A1';
const PORT_ECHONET = 3610;
const GET_INSTANTANEOUS_ELECTRIC_ENERGY = '1081000005ff010288016201e700';
enum CLASS {
  LOW_VOLTAGE_SMART_ELECTRIC_ENERGY_METER = 0x0288
}
enum ESV {
  GET_RES = 0x72
}
enum EPC {
  INSTANTANEOUS_ELECTRIC_ENERGY = 0xe7
}
const wsun = WsunGetAdaptor(DEVICE_NAME, config);
let tid = 0;
let wattMin = Number.MAX_VALUE;
let wattMax = Number.MIN_VALUE;

function createRequest(): Buffer {
  tid += 1;
  tid &= 0xffff;
  const frame = Buffer.from(GET_INSTANTANEOUS_ELECTRIC_ENERGY, 'hex');
  frame.writeUInt16BE(tid, 2);
  return frame;
}

function hitAnyKey(callback: () => void) {
  return new Promise<void>(resolve => {
    console.log('example3: hit any key to end');
    process.stdin.on('data', () => {
      // wait for any key
      callback();
      resolve();
    });
  });
}

async function pollElectricEnergy(socket: WsunSocket, address: string) {
  const timer = setInterval(() => socket.send(createRequest(), PORT_ECHONET, address), 60 * 1000);
  await hitAnyKey(() => clearInterval(timer));
}

async function main() {
  try {
    if (!wsun) {
      console.log('example3: cannot get an adaptor for', DEVICE_NAME);
      return;
    }
    console.log('example3: finding ...');
    const descriptor = await wsun.open(wsid, cache);
    if (!descriptor) {
      console.log('example3: no PaC found');
      return;
    }
    console.log('example3: found a device', JSON.stringify(descriptor));
    const socket = wsun.createSocket();
    await socket
      .on('message', rudp => {
        if (rudp.readUInt16BE(4) !== CLASS.LOW_VOLTAGE_SMART_ELECTRIC_ENERGY_METER) return;
        if (rudp.readUInt8(10) !== ESV.GET_RES) return;
        if (rudp.readUInt8(12) !== EPC.INSTANTANEOUS_ELECTRIC_ENERGY) return;
        if (rudp.readUInt16BE(2) !== tid) return;
        const watt = rudp.readInt32BE(rudp.length - 4);
        wattMin = Math.min(watt, wattMin);
        wattMax = Math.max(watt, wattMax);
        const timestamp = new Date().toLocaleTimeString();
        console.log(`example3: ${timestamp} ${watt}watt ${wattMin}(min)/${wattMax}(max)`);
      })
      .bind(PORT_ECHONET);
    await pollElectricEnergy(socket, descriptor.addr);
    await socket.close();
    await wsun.close();
  } catch (err) {
    console.error('example3: ', (err as Error).message);
  } finally {
    console.log('example3: done');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
