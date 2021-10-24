/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunConfig } from './wsun-interfaces';
import { WsunAdaptor, WsunEventSession } from './wsun-adaptor';
import { WsunBp35a1 } from './wsun-bp35a1';
import DEBUG from 'debug';
const debug = DEBUG('wsun/adaptor');

export { MAX_DGRAM_SIZE } from './wsun-device-constants';
export { WsunAdaptor, WsunEventSession };
export { WsunId, WsunPanDesc, WsunSocket, WsunConfig, WsunCache } from './wsun-interfaces';
export {
  WsunError,
  WsunSendingInProgress,
  WsunUdpTransmissionFailed,
  WsunCommandError,
  WsunTimeoutError
} from './wsun-errors';

export type NameOfClass = 'BP35A1' | 'MOCK';
export interface MockConstructor {
  new (config: WsunConfig): WsunAdaptor;
}

let instance: WsunAdaptor;

/**
 *  Class factory to get a wsun adaptor
 *  @param  className is model name of adaptor you want
 *  @param  config
 *  @return an instance of adaptor which is specified by the model name
 */
export function WsunGetAdaptor(
  className: NameOfClass,
  config?: WsunConfig
): WsunAdaptor | undefined {
  debug('WsunGetAdaptor:', className, JSON.stringify(config));
  if (!instance && config) {
    switch (className) {
      case 'BP35A1':
        instance = new WsunBp35a1(config);
        break;
    }
  }
  return instance;
}
