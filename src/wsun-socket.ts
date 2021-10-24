/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import promiseRetry from 'promise-retry';
import { EventEmitter } from 'events';
import { MAX_DGRAM_SIZE } from './wsun-device-constants';
import { WsunUDP, WsunSocket, WsunAdaptorInternal } from './wsun-interfaces';
import { isMac, isIPv6 } from './wsun-libs';
import { WsunError, WsunSendingInProgress } from './wsun-errors';
import DEBUG from 'debug';
const debug = DEBUG('wsun/socket');

function sleep(delay: number) {
  return new Promise<void>(resolve => setTimeout(() => resolve(), delay));
}

/**
 *  Datagram socket for communicating with wsun nodes,
 *  which provides some functionalities of Nodejs's UDP/datagram socket.
 */
export class WsunAdaptorSocket extends EventEmitter implements WsunSocket {
  private listeningPort?: number;
  private listener?: (udp: WsunUDP) => void;
  private busy = false;
  private closing = false;

  constructor(private adaptor: WsunAdaptorInternal) {
    super();
  }

  /**
   *  Listen for datagram messages on the specified port.
   *
   *  @param port - port number to be listened
   *  @event message - is fired when a new datagram is available on a socket.
   *    The event handler function is passed two arguments:
   *      `msg: Buffer` and `rinfo: RemoteInfo`.
   */
  bind(port: number): Promise<void> {
    debug('wsun-socket.bind', port);
    if (port < 1 || port > 0xffff) {
      return Promise.reject(new RangeError('The port muse be 1 <= and <= 0xffff'));
    }
    if (this.listeningPort) {
      return Promise.reject(new WsunError('Already listening the port'));
    }
    this.listeningPort = port;
    this.adaptor.on(
      'rxudp',
      (this.listener = (udp: WsunUDP) => {
        if (this.listeningPort === udp.rport) {
          this.emit('message', udp.data, {
            address: udp.sender,
            family: 'IPv6',
            port: udp.lport,
            size: udp.datalen
          });
        }
      })
    );
    return Promise.resolve();
  }

  /**
   * Close the underlying socket and stop listening for data on it.
   */
  async close(): Promise<void> {
    debug('wsun-socket.close');
    this.closing = true;
    if (this.busy) {
      console.info('wsun: closing socket is pending');
      await sleep(1 * 1000);
      return this.close();
    } else {
      if (this.listeningPort) {
        this.listeningPort = undefined;
      }
      if (this.listener) {
        this.adaptor.removeListener('rxudp', this.listener);
        this.listener = undefined;
      }
      this.adaptor.deleteSocket(this);
      this.closing = false;
      return Promise.resolve();
    }
  }

  /**
   *  Send a datagram message to the specified destination.
   *  @param  msg  to be sent.
   *  @param  port  is destination port.
   *  @param  address is destination address.
   */
  send(msg: Buffer, port: number, address: string): Promise<void> {
    debug('wsun-socket.send');
    if (port < 1 || port > 0xffff) {
      return Promise.reject(new RangeError('The port muse be 1 <= and <= 0xffff'));
    }
    if (!isMac.test(address) && !isIPv6.test(address)) {
      return Promise.reject(new TypeError(`${address} must be ipv6 or mac address`));
    }

    if (msg.length > MAX_DGRAM_SIZE) {
      return Promise.reject(new Error(`Size of dgram is too large, ${msg.length}`));
    }
    if (!this.adaptor.isOnline() || this.closing) {
      const err = new Error('Invalid state');
      console.error('wsadaptor: wsun-socket.send', err.stack);
      return Promise.reject(err);
    }

    this.busy = true;
    return promiseRetry(
      (retry, count) =>
        this.adaptor.sendDgram(msg, port, address).catch(err => {
          if (err instanceof WsunSendingInProgress) {
            console.info('wsadaptor: wssocket.send: retry', count);
            return retry(err);
          }
          throw err;
        }),
      {
        retries: 3
      }
    ).then(() => {
      this.busy = false;
    });
  }
}
