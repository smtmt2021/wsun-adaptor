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
const GET_INSTANCE_LIST = '1081000105ff010ef0006201d600';

function getInstanceList(socket: WsunSocket, address: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const request = Buffer.from(GET_INSTANCE_LIST, 'hex');
    socket.on('message', rudp => {
      if (request.readUIntBE(2, 2) === rudp.readUIntBE(2, 2)) {
        resolve(rudp);
      }
    }).bind(PORT_ECHONET).then(() =>
      socket.send(request, PORT_ECHONET, address)
    ).catch(err => reject(err));
  });
}

async function main() {
  try {
    const wsun = WsunGetAdaptor(DEVICE_NAME, config);
    if (!wsun) {
      console.log('example2: cannot get an adaptor for', DEVICE_NAME);
      return;
    }
    console.log('example2: finding a PaC...');
    const descriptor = await wsun.open(wsid, cache);
    if (!descriptor) {
      console.log('example2: no PaC found');
      return;
    }
    console.log('example2: found a PaC', JSON.stringify(descriptor));
    const socket = wsun.createSocket();
    const response = await getInstanceList(socket, descriptor.addr);
    console.log('example2: the instance is', response.toString('hex').slice(-6));
    await socket.close();
    await wsun.close();
  } catch (err) {
    console.error('example2: ', (err as Error).message);
  } finally {
    console.log('example2: done');
  }
}

main().catch(err => {
  console.error((err as Error).message);
  process.exit(1);
});
