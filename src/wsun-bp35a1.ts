/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { Writable } from 'stream';
import SerialPort from 'serialport';
import promiseRetry from 'promise-retry';
import { EventEmitter } from 'events';
import * as WDC from './wsun-device-constants';
import {
  isValidCache,
  isParamOfPanDesc,
  isNumber,
  isMac,
  isIPv6,
  num2hex,
  msec2duration
} from './wsun-libs';
import { WsunAdaptorSocket } from './wsun-socket';
import { PanDescriptor } from './wsun-pandescriptor';
import {
  WsunId,
  WsunCache,
  WsunPanDesc,
  WsunSocket,
  WsunConfig,
  WsunAdaptor,
  WsunError,
  WsunSendingInProgress,
  WsunUdpTransmissionFailed,
  WsunCommandError,
  WsunTimeoutError,
  WsunEventSession
} from './';
import DEBUG from 'debug';
import { WsunAdaptorInternal, WsunEventUdp, WsunUDP } from './wsun-interfaces';
const debug = DEBUG('wsun/adaptor');
const Regex = SerialPort.parsers.Regex;
const UDP_TABLE_SIZE = 6;
const isTesting = process.env.NODE_ENV === 'test';

interface WsunConfigExt extends WsunConfig {
  test: boolean;
  options: SerialPort.OpenOptions;
}

enum STATE {
  CLOSE,
  ONLINE
}

type ResultOfSend = {
  success: boolean;
  mode?: number;
};

export class WsunBp35a1 implements WsunAdaptor, WsunAdaptorInternal {
  private serialport: SerialPort;
  private receiver?: Writable;
  private state = STATE.CLOSE;
  private config: WsunConfigExt;
  private portmap = [0, 0, 0, 0, 0, 0];
  private outstandingSockets: WsunSocket[] = [];
  private sendingInProgress = false;
  private eventExternal = new EventEmitter();
  private eventInternal = new EventEmitter();

  private portopen(): Promise<void> {
    return new Promise<void>((resolve, reject) =>
      this.serialport.open(err => (!err ? resolve() : reject(err)))
    );
  }

  private portflush(): Promise<void> {
    return new Promise<void>((resolve, reject) =>
      this.serialport.flush(err => (!err ? resolve() : reject(err)))
    );
  }

  private portclose(): Promise<void> {
    return new Promise<void>((resolve, reject) =>
      this.serialport.close(err => (!err ? resolve() : reject(err)))
    );
  }

  private portwrite(data: string | number[] | Buffer): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.serialport.write(data, (err, byteWritten) => {
        if (err) {
          return reject(err);
        }
        return resolve(byteWritten);
      });
    });
  }

  protected getScanTimeout(msec: number): number {
    const t = this.config.test ? 1 : 33; // 33 == (# of channels) + 1
    return msec * t;
  }

  /**
   *  Read a port map table from adaptor
   */
  protected async readPortMapTable(): Promise<void> {
    const portListener = () => {
      debug('wsadaptor.portmap: started');
      this.portmap = [];
    };
    const numberListener = (port: number) => {
      debug('wsadaptor.portmap: port#', port);
      if (port >= 0 && port <= 0xffff && this.portmap.length < UDP_TABLE_SIZE) {
        this.portmap.push(port);
      }
    };
    try {
      this.eventInternal.once('port', portListener);
      this.eventInternal.on('number', numberListener);
      await this.send('SKTABLE E\r\n');
      debug('readPortMapTable', JSON.stringify(this.portmap));
    } catch (err) {
      console.error('wsadaptor:', (err as Error).message);
      throw err;
    } finally {
      this.eventInternal.removeListener('port', portListener);
      this.eventInternal.removeListener('number', numberListener);
    }
  }

  protected eventMonitor(on: boolean): void {
    if (on) {
      this.eventInternal.on('rxudp', udp => this.eventExternal.emit('rxudp', udp));
      this.eventInternal.on('event25', () => this.eventExternal.emit('session-established'));
      this.eventInternal.on('event26', () => this.eventExternal.emit('session-ending'));
      this.eventInternal.on('event27', () => this.eventExternal.emit('session-ended'));
      this.eventInternal.on('event28', () => this.eventExternal.emit('session-error'));
      this.eventInternal.on('event29', () => this.eventExternal.emit('session-timeout'));
      this.eventInternal.on('event32', () => this.eventExternal.emit('session-108-start'));
      this.eventInternal.on('event33', () => this.eventExternal.emit('session-108-end'));
    } else {
      this.eventInternal.removeAllListeners('rxudp');
      this.eventInternal.removeAllListeners('event25');
      this.eventInternal.removeAllListeners('event26');
      this.eventInternal.removeAllListeners('event27');
      this.eventInternal.removeAllListeners('event28');
      this.eventInternal.removeAllListeners('event29');
      this.eventInternal.removeAllListeners('event32');
      this.eventInternal.removeAllListeners('event33');
    }
  }

  /**
   *  Retrieve PAN descriptor from input stream
   *  @event pandesc
   */
  protected pandescMonitor(on: boolean): void {
    const descriptor = new PanDescriptor();

    if (on) {
      this.eventInternal.on('epandesc', () => descriptor.reset());
      this.eventInternal.on('number', () => descriptor.reset());
      this.eventInternal.on('ipv6', () => descriptor.reset());
      this.eventInternal.on('param', (param: string) => {
        const params = param.split(':');
        if (params.length !== 2) {
          return descriptor.reset();
        }
        switch (params[0]) {
          case 'Channel':
            descriptor.channel = params[1];
            break;
          case 'Channel Page':
            descriptor.page = params[1];
            break;
          case 'Pan ID':
            descriptor.panId = params[1];
            break;
          case 'Addr':
            descriptor.addr = params[1];
            break;
          case 'LQI':
            descriptor.LQI = params[1];
            break;
          case 'PairID':
            descriptor.pairId = params[1];
            break;
          default:
            return descriptor.reset();
        }
        if (descriptor.isValid) {
          debug('pandescMonitor', 'pandesc', descriptor.toString());
          this.eventInternal.emit('pandesc', descriptor.getDescriptor());
        }
      });
    } else {
      this.eventInternal.removeAllListeners('epandesc');
      this.eventInternal.removeAllListeners('number');
      this.eventInternal.removeAllListeners('ipv6');
      this.eventInternal.removeAllListeners('param');
    }
  }

  /**
   *  A receiver for BP35A1 which parse a line
   *  then emits the following events;
   *  @event param
   *  @event number
   *  @event ipv6
   *  @event ok
   *  @event fail
   *  @event rxudp
   *  @event epandesc
   *  @event port
   *  @event sreg
   *  @event event20
   *  @event event21
   *  @event event22
   *  @event event24
   *  @event event25
   *  @event event26
   *  @event event27
   *  @event event28
   *  @event event29
   *  @event event32
   *  @event event33
   */
  protected monitor(aline: string): void {
    if (isParamOfPanDesc.test(aline)) {
      debug('monitor', 'param', aline);
      this.eventInternal.emit('param', aline.substr(2));
    } else if (isNumber.test(aline)) {
      debug('monitor', 'number', aline);
      this.eventInternal.emit('number', parseInt(aline));
    } else if (isIPv6.test(aline)) {
      debug('monitor', 'ipv6', aline);
      this.eventInternal.emit('ipv6', aline);
    } else {
      const args = aline.split(' ');
      switch (args[0]) {
        case 'OK':
          if (args.length > 1) {
            const n = parseInt(args[1], 16);
            debug('monitor', 'OK', n);
            this.eventInternal.emit('ok', n);
          } else {
            debug('monitor', 'OK');
            this.eventInternal.emit('ok');
          }
          break;
        case 'FAIL': {
          debug('monitor', 'FAIL');
          if (args.length > 1) {
            console.info('wsadaptor: command fail received', args[1]);
            this.eventInternal.emit('fail', args[1]);
          } else {
            console.info('wsadaptor: command fail received');
            this.eventInternal.emit('fail');
          }
          break;
        }
        case 'EVENT':
          if (args.length >= 3) {
            const eventno = parseInt(args[1], 16);
            const eventname = `event${num2hex(eventno, 1)}`;
            switch (eventno) {
              case 0x21:
                if (args.length !== 4) {
                  console.info('wsadaptor: erroneous args of event21 received', args);
                } else {
                  const param = parseInt(args[3], 16);
                  debug(`event21: received from ${args[2]} with ${param}`);
                  this.eventInternal.emit('event21', args[2], param);
                }
                break;
              case 0x20:
              case 0x22:
              case 0x24:
              case 0x25:
              case 0x26:
              case 0x27:
              case 0x28:
              case 0x29:
              case 0x32:
              case 0x33:
                debug(`${eventname} received from ${args[2]}`);
                this.eventInternal.emit(eventname, args[2]);
                break;
              default:
                debug(`${eventname} received from ${args[2]}`);
            }
          }
          break;
        case 'ERXUDP':
          debug('monitor', 'ERXUDP', args);
          if (args.length === 9) {
            this.eventInternal.emit('rxudp', {
              sender: args[1],
              dest: args[2],
              rport: parseInt(args[3], 16),
              lport: parseInt(args[4], 16),
              senderlla: args[5],
              secured: parseInt(args[6]),
              datalen: parseInt(args[7], 16),
              data: Buffer.from(args[8], 'hex')
            });
          }
          break;
        case 'EPANDESC':
          debug('monitor', 'EPANDESC');
          this.eventInternal.emit('epandesc');
          break;
        case 'EPORT':
          debug('monitor', 'EPORT');
          this.eventInternal.emit('port');
          break;
      }
    }
  }

  /**
   *  Construct an interface for wsun adaptor
   *  @param  config  provides configuration to construct the interface.
   */
  constructor(config: WsunConfig) {
    this.config = Object.assign(
      {
        test: isTesting,
        options: {
          baudRate: 115200,
          autoOpen: false
        }
      },
      config
    );
    try {
      this.serialport = new SerialPort(this.config.device, this.config.options);
    } catch (err) {
      console.error('wsadaptor: cannot set up serialport', (err as Error).message);
      throw new WsunError('cannot set up serialport');
    }
  }

  /**
   *  Check if connection with wsun adaptor.
   *  @return true if the connection is online.
   */
  isOnline(): boolean {
    return this.state === STATE.ONLINE;
  }

  /**
   *  Start activities with a wsun adaptor
   *  and establish a connection with PAA coordinator.
   *  @param  wsunId  ID, the password and cache info.
   *  @returns  a descriptor of the connected PAA coordinator,
   *            undefined if no PAA found.
   *  @event session-established  a PANA session is established
   *  @event session-ending       receive a PANA session end request
   *  @event session-ended        a PANA session is ended
   *  @event session-error        a PANA session is ended due to error
   *  @event session-timeout      a PANA session is ended due to timeout
   *  @event session-108-start    Restriction of ARIB 108 is started
   *  @event session-108-end      Restriction of ARIB 108 is ended
   */
  async open(wsunId: WsunId, cache?: WsunCache): Promise<WsunPanDesc | undefined> {
    debug('open');
    if (wsunId.id.length !== 32) {
      throw new RangeError('Wsun ID must be 32 charactors');
    }
    if (wsunId.password.length < 1 || wsunId.password.length > 32) {
      throw new RangeError('Wsun password must be 1 <= and <= 32');
    }
    if (cache && !isValidCache(cache)) {
      throw new TypeError('Spcecified cache is invalid');
    }
    if (this.state !== STATE.CLOSE) {
      throw new Error('Invalid state');
    }
    try {
      this.receiver = this.serialport.pipe(new Regex({ regex: /[\r\n]+/ }));
      this.receiver.on('data', (data: string) => this.monitor(data));
      this.pandescMonitor(true);
      this.eventMonitor(true);
      await this.portopen();
      await this.portflush();
      await this.disableEchoBack();
      await this.letAsciiMode();
      await this.readPortMapTable();
      const descriptor = await this.connect(wsunId, cache);
      if (descriptor) {
        this.state = STATE.ONLINE;
      } else {
        await this.cleanup();
      }
      return descriptor;
    } catch (err) {
      console.error('wsadaptor:', (err as Error).message);
      await this.cleanup();
      throw err; // rethrow original error
    }
  }

  /**
   *  Terminate a connection with a PAA coordinator
   */
  async close(): Promise<void> {
    debug('wsun-bp35a1.close');
    if (this.state === STATE.CLOSE) {
      return;
    }
    for (const socket of this.outstandingSockets) {
      await socket.close();
    }
    try {
      await this.terminate();
    } catch (err) {
      console.info('wsadaptor: found an issue while closing', (err as Error).message);
    } finally {
      await this.cleanup();
      this.state = STATE.CLOSE;
    }
  }

  /**
   * Add a listener for the event
   * @param en
   * @param listener
   * @event 'rxudp'
   * @event 'session-established' a PANA session is established
   * @event 'session-ending'      receive a PANA session end request
   * @event 'session-ended'       a PANA session is ended
   * @event 'session-error'       a PANA session is ended due to error
   * @event 'session-timeout'     a PANA session is ended due to timeout
   * @event 'session-108-start'   Restriction of ARIB 108 is started
   * @event 'session-108-end'     Restriction of ARIB 108 is ended
   */
  on(en: WsunEventUdp, listener: (udp: WsunUDP) => void): void;
  on(en: WsunEventSession, listener: () => void): void;
  on(en: WsunEventUdp | WsunEventSession, listener: (udp: WsunUDP) => void): void {
    this.eventExternal.on(en, listener);
  }

  /**
   * removes the specified listener for the event
   * @param en
   * @param listener
   */
  removeListener(en: WsunEventUdp, listener: (udp: WsunUDP) => void): void {
    this.eventExternal.removeListener(en, listener);
  }

  /**
   *  Create a socket to communicate remote node.
   *  @return a socket.
   */
  createSocket(): WsunSocket {
    const socket = new WsunAdaptorSocket(this);
    this.outstandingSockets.push(socket);
    return socket;
  }

  /**
   *  Delete a used socket.
   *  This function is called automatically whenever a socket is closed.
   *  @param  socket  to be delete.
   */
  deleteSocket(socket: WsunSocket): void {
    const index = this.outstandingSockets.indexOf(socket);
    if (index !== -1) {
      this.outstandingSockets.splice(index, 1);
    }
  }

  /**
   *  Send a datagram message to the specified destination.
   *  This function is called via socket, do not call directly.
   *  @param  msg  to be sent.
   *  @param  port  is destination port.
   *  @param  address is destination address.
   */
  async sendDgram(msg: Buffer, port: number, address: string): Promise<void> {
    debug('wsun-bp35a1.sendDgram', msg.toString('hex'));
    if (msg.length > WDC.MAX_DGRAM_SIZE) {
      throw new Error(`Size of dgram is too large, ${msg.length}`);
    }
    if (port < 1 || port > 0xffff) {
      throw new RangeError('The port muse be 1 <= and <= 0xffff');
    }
    if (this.state !== STATE.ONLINE) {
      throw new Error('Invalid state');
    }
    if (this.sendingInProgress) {
      debug('wsun-bp35a1.sendDgram: sending in progress');
      throw new WsunSendingInProgress();
    }
    this.sendingInProgress = true;
    try {
      let ipv6: string;
      if (isMac.test(address)) {
        ipv6 = await this.lookup(address);
      } else if (isIPv6.test(address)) {
        ipv6 = address;
      } else {
        throw new TypeError(`'${address}' must be ipv6 or mac address`);
      }
      const handle = this.getHandle(port);
      if (!handle) {
        throw new WsunError('no handle to send a dgram');
      }

      const porthex = num2hex(port);
      const lenhex = num2hex(msg.length);
      const sec = '2';
      const msgHeader = Buffer.from(`SKSENDTO ${handle} ${ipv6} ${porthex} ${sec} ${lenhex} `);
      // send data as text instead of binary in testing mode.
      const data = this.config.test ? Buffer.from(msg.toString('hex') + '\r\n') : msg;
      const buffer = Buffer.concat([msgHeader, data], msgHeader.length + data.length);

      await promiseRetry<void>(
        (retry, count) =>
          this.sendto(buffer, address).catch(err => {
            if (err instanceof WsunUdpTransmissionFailed) {
              console.info('wsadaptor: senddgram: retry', count);
              return retry(err);
            }
            throw err;
          }),
        {
          retries: 3,
          factor: 1
        }
      ).catch(err => {
        console.error('wsadaptor: senddgram:', (err as Error).message);
        throw err;
      });
    } finally {
      this.sendingInProgress = false;
    }
  }

  /**
   *  Connect to a node specified with wi-sun id.
   *  @param wsunId
   *  @returns a PAN descriptor if success, undefined if failed.
   */
  protected async connect(wsunId: WsunId, cache?: WsunCache): Promise<WsunPanDesc | undefined> {
    debug('connect');
    await this.setId(wsunId.id);
    await this.setPwd(wsunId.password);

    let descriptors: WsunPanDesc[];
    if (cache) {
      const ipv6 = await this.lookup(cache.addr);
      await this.setNeighbor(cache.addr, ipv6);
      descriptors = [cache];
    } else {
      descriptors = await this.scan(WDC.SCAN_TIMEOUT);
      if (descriptors.length === 0) {
        console.log('wsadaptor: No PAN found');
        return undefined;
      }
    }

    for (const descriptor of descriptors) {
      try {
        const result = await this.join(descriptor.addr, descriptor.channel, descriptor.panId);
        if (result) {
          return descriptor;
        }
      } catch (err) {
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      }
    }
    return undefined;
  }

  /**
   *  Execute active scanning
   *  @param msec
   *  @param mask
   *  @return array of PAN descriptors
   */
  protected scan(msec: number, mask = 0xffffffff): Promise<WsunPanDesc[]> {
    debug('scan', msec, num2hex(mask, 4));
    const mode = 2;
    const channelMask = mask.toString(16);
    const duration = msec2duration(msec).toString(16);
    const descriptors: WsunPanDesc[] = [];
    const pandescListener = (desc: WsunPanDesc) => {
      debug('scan.pandesc', JSON.stringify(desc));
      descriptors.push(desc);
    };
    let event22listener: () => void;
    let timer: NodeJS.Timer;

    return this.send(`SKSCAN ${mode} ${channelMask} ${duration}\r\n`)
      .then(
        () =>
          new Promise<WsunPanDesc[]>((resolve, reject) => {
            event22listener = () => {
              debug('scan.event22');
              console.log('wsadaptor: PAN(s) found', JSON.stringify(descriptors));
              resolve(descriptors);
            };
            const timeoutHandler = () => {
              reject(new Error('Timeout while scanning PAN'));
            };
            this.eventInternal.on('pandesc', pandescListener);
            this.eventInternal.once('event22', event22listener);
            timer = setTimeout(timeoutHandler, this.getScanTimeout(msec));
          })
      )
      .catch(err => {
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (event22listener) this.eventInternal.removeListener('event22', event22listener);
        this.eventInternal.removeListener('pandesc', pandescListener);
      });
  }

  /**
   *  Start PANA connection sequence to connect
   *  @param target
   *  @param channel
   *  @param panId
   *  @return true if success.
   */
  protected join(target: string, channel: number, panId: number): Promise<boolean> {
    debug('join', target, channel, panId);
    if (!isMac.test(target)) {
      return Promise.reject(new TypeError(`The '${target}' must be mac address`));
    }
    if (channel < 0x21 || channel > 0x3c) {
      return Promise.reject(new RangeError('The channel must be >= 0x21 and <= 0x31'));
    }
    if (panId < 0 || panId > 0xffff) {
      return Promise.reject(new RangeError('The PAN ID must be >= 0 and <= 0xffff'));
    }
    let event24listener: () => void;
    let event25listener: () => void;
    let timer: NodeJS.Timer;

    return this.setChannelNumber(channel)
      .then(() => this.setPanId(panId))
      .then(() => this.lookup(target))
      .then(ipv6 => this.send(`SKJOIN ${ipv6}\r\n`))
      .then(
        () =>
          new Promise<boolean>((resolve, reject) => {
            event24listener = () => {
              console.info('wsadaptor: Failed making a PANA connection');
              resolve(false);
            };
            event25listener = () => {
              console.info('wsadaptor: A PANA connection established successfully');
              resolve(true);
            };
            const timeoutHandler = () => {
              reject(new Error('Timeout while making a PANA connection'));
            };
            this.eventInternal.once('event24', event24listener);
            this.eventInternal.once('event25', event25listener);
            timer = setTimeout(timeoutHandler, WDC.CONNECTION_TIMEOUT);
          })
      )
      .catch(err => {
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (event24listener) this.eventInternal.removeListener('event24', event24listener);
        if (event25listener) this.eventInternal.removeListener('event25', event25listener);
      });
  }

  /**
   *  Send a command to adaptor
   *  @param command  is a command to be send to an adaptor.
   *  @return a parameter following OK.
   */
  protected send(command: Buffer | string): Promise<ResultOfSend> {
    debug(
      `send: "${
        typeof command === 'string' ? command.replace(/(\r\n)|(\r)$/g, '') : command.toString('hex')
      }"`
    );
    let okListener: (mode?: number) => void;
    let failListener: (reason: number) => void;
    let timer: NodeJS.Timer;

    return this.portwrite(command)
      .then(
        () =>
          new Promise<ResultOfSend>((resolve, reject) => {
            okListener = (mode?: number) => resolve({ success: true, mode });
            failListener = (reason: number) => reject(new WsunCommandError(reason));
            this.eventInternal.once('ok', okListener);
            this.eventInternal.once('fail', failListener);
            timer = setTimeout(
              () => reject(new WsunTimeoutError('command timeout')),
              WDC.COMMAND_TIMEOUT
            );
          })
      )
      .catch(err => {
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (okListener) this.eventInternal.removeListener('ok', okListener);
        if (failListener) this.eventInternal.removeListener('fail', failListener);
      });
  }

  /**
   *  Send a data to node via adaptor
   *  @param data to be sent
   *  @param address of the node
   */
  protected sendto(data: Buffer, address: string): Promise<void> {
    let event21reason: number;
    const event21listener = (sendar: string, reason: number) => {
      if (address === sendar) {
        event21reason = reason;
      }
    };
    this.eventInternal.once('event21', event21listener);

    return this.send(data).then(() => {
      if (event21reason === 1) {
        console.info('wsadaptor: udp transmission failed');
        throw new WsunUdpTransmissionFailed();
      }
    }).finally(() => this.eventInternal.removeListener('event21', event21listener));
  }

  /**
   *  Get a local link address from MAC address
   *  @param  mac is IEEE 64bit mac address.
   *  @return IPv6 local link address
   */
  protected lookup(mac: string): Promise<string> {
    let addressListener: (address: string) => void;
    let failListener: (reason: number) => void;
    let timer: NodeJS.Timer;

    return this.portwrite(`SKLL64 ${mac}\r\n`)
      .then(
        () =>
          new Promise<string>((resolve, reject) => {
            addressListener = (address: string) => {
              debug('SKLL64: response', address);
              resolve(address);
            };
            failListener = (reason: number) => {
              debug('SKLL64: failed', mac, reason);
              reject(reason);
            };
            this.eventInternal.once('ipv6', addressListener);
            this.eventInternal.once('fail', failListener);
            timer = setTimeout(
              () => reject(new WsunTimeoutError('command timeout')),
              WDC.COMMAND_TIMEOUT
            );
          })
      )
      .catch(err => {
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (addressListener) this.eventInternal.removeListener('ipv6', addressListener);
        if (failListener) this.eventInternal.removeListener('fail', failListener);
      });
  }

  protected async setChannelNumber(channel: number): Promise<void> {
    debug('setChannelNumber', channel?.toString(16));
    await this.send(`SKSREG S02 ${num2hex(channel, 1)}\r\n`);
  }

  protected async setPanId(id: number): Promise<void> {
    debug('setPanId');
    await this.send(`SKSREG S03 ${num2hex(id)}\r\n`);
  }

  /**
   *  Set up a password into adaptor
   *  @param pwd is a password to be put into an adaptor.
   */
  protected async setPwd(pwd: string): Promise<void> {
    debug('setPwd');
    await this.send(`SKSETPWD ${num2hex(pwd.length, 1)} ${pwd}\r\n`);
  }

  /**
   *  Set up an id into adaptor
   *  @param pwd is an id to be put into an adaptor.
   */
  protected async setId(id: string): Promise<void> {
    debug('setId');
    await this.send(`SKSETRBID ${id}\r\n`);
  }

  /**
   *  Set up neighbor cache with ...
   *  @param mac  mac address
   *  @param ipv6 ipv6 address
   */
  protected async setNeighbor(mac: string, ipv6: string): Promise<void> {
    debug('setNeighbor');
    await this.send(`SKADDNBR ${ipv6} ${mac}\r\n`);
  }

  /**
   *  Get a handle number from port map table
   *  @param port is a port number to get the corresponding handle number.
   *  @returns handle number against the specified port.
   */
  protected getHandle(port: number): number | undefined {
    for (let i = 0; i < this.portmap.length; ++i) {
      if (this.portmap[i] === port) {
        return ++i;
      }
    }
  }

  /**
   *  Get ascii mode of rxudp
   *  @return state of ascii mode
   */
  protected async getAsciiMode(): Promise<boolean> {
    debug('getAsciiMode');
    const { success, mode } = await this.send('ROPT\r');
    if (!success || mode == null) {
      throw new WsunError('unexpected error occured while reading ascii mode');
    }
    return !!(mode & 0x01);
  }

  /**
   *  Set ascii mode of rxudp
   */
  protected async setAsciiMode(): Promise<void> {
    debug('setAsciiMode');
    await this.send('WOPT 01\r');
  }

  /**
   *  Let adaptor be ascii mode
   */
  protected async letAsciiMode(): Promise<void> {
    debug('letAsciiMode');
    const mode = await this.getAsciiMode();
    if (!mode) {
      await this.setAsciiMode();
    }
  }

  /**
   *  Disable echo back mode
   */
  protected async disableEchoBack(): Promise<void> {
    debug('disableEchoBack');
    await this.send('SKSREG SFE 0\r\n');
  }

  /**
   *  Terminate current PANA session
   */
  protected terminate(): Promise<void> {
    let event27listener: () => void;
    let event28listener: () => void;
    let timer: NodeJS.Timer;

    return this.send('SKTERM\r\n')
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            event27listener = () => resolve();
            event28listener = () => resolve();
            this.eventInternal.once('event27', event27listener); // success!!!
            this.eventInternal.once('event28', event28listener); // success!!!
            timer = setTimeout(
              () => reject(new WsunTimeoutError('termination timeout')),
              WDC.TERM_TIMEOUT
            );
          })
      )
      .catch(err => {
        if (err instanceof WsunCommandError && err.reason === 10) {
          console.info('wsadaptor:', "PANA session isn't established");
          return Promise.resolve();
        }
        console.error('wsadaptor:', (err as Error).message);
        throw err;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (event27listener) this.eventInternal.removeListener('event27', event27listener);
        if (event28listener) this.eventInternal.removeListener('event28', event28listener);
      });
  }

  private async cleanup() {
    if (this.serialport.isOpen) {
      try {
        await this.portclose();
      } catch (err) {
        console.error('wsadaptor: failed to close serial port', (err as Error).message);
      }
    }
    this.eventInternal.removeAllListeners();
    this.eventExternal.removeAllListeners();
    this.eventMonitor(false);
    this.pandescMonitor(false);
    if (this.receiver) {
      this.receiver.removeAllListeners('data');
      this.receiver.destroy();
      this.receiver = undefined;
    }
  }
}
