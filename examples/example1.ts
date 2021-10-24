/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunGetAdaptor } from '../src';

const config = {
  device: process.env.WSDEV || ''
};
const wsid = {
  id: process.env.WSID || '',
  password: process.env.WSPWD || ''
};

const DEVICE_NAME = 'BP35A1';

async function main() {
  try {
    const wsun = WsunGetAdaptor(DEVICE_NAME, config);
    if (!wsun) {
      console.log('example1: cannot get an adaptor for', DEVICE_NAME);
      return;
    }
    const descriptor = await wsun.open(wsid);
    if (!descriptor) {
      console.log('example1: no PaC found');
      return;
    }
    console.log('example1: found a PaC', JSON.stringify(descriptor));
    await wsun.close();
  } catch (err) {
    console.error('example1: ', (err as Error).message);
  } finally {
    console.log('example1: done');
  }
}

main().catch(err => {
  console.error((err as Error).message);
  process.exit(1);
});
