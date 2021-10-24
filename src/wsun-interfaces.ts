/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { RemoteInfo } from 'dgram';

export type WsunEventUdp = 'rxudp';

export interface WsunCache {
  channel: number;
  panId: number;
  addr: string;
}

export interface WsunPanDesc extends WsunCache {
  page?: number;
  pairId?: string;
  LQI?: number;
}

export interface WsunId {
  id: string;
  password: string;
}

export interface WsunUDP {
  sender: string;
  dest: string;
  rport: number;
  lport: number;
  senderlla: string;
  secured: boolean;
  datalen: number;
  data: Buffer;
}

export interface WsunSocket {
  bind(port: number): Promise<void>;
  close(): Promise<void>;
  send(msg: Buffer | string, port: number, address: string): Promise<void>;
  on(event: 'message', listener: (msg: Buffer, rinfo: RemoteInfo) => void): this;
  once(event: 'message', listener: (msg: Buffer, rinfo: RemoteInfo) => void): this;
  removeListener(event: 'message', listener: (msg: Buffer, rinfo: RemoteInfo) => void): this;
  removeAllListeners(event: 'message'): this;
}

export interface WsunConfig {
  device: string; // device name of serial port which is connected with wsun adaptor
}

export interface WsunAdaptorInternal {
  /**
   *  Check if connection with wsun adaptor.
   *  @return true if the connection is online.
   */
  isOnline(): boolean;

  /**
   *  Delete a used socket.
   *  This function is called automatically whenever a socket is closed.
   *  @param  socket  to be delete.
   */
  deleteSocket(socket: WsunSocket): void;

  /**
   *  Send a datagram message to the specified destination.
   *  This function is called via socket, do not call directly.
   *  @param  msg  to be sent.
   *  @param  port  is destination port.
   *  @param  address is destination address.
   */
  sendDgram(msg: Buffer, port: number, address: string): Promise<void>;

  /**
   * Add a listener for the event
   * @param en
   * @param listener
   * @event 'rxudp'
   */
  on(en: WsunEventUdp, listener: (udp: WsunUDP) => void): void;

  /**
   * removes the specified listener from the event
   * @param en
   * @param listener
   */
  removeListener(en: WsunEventUdp, listener: (udp: WsunUDP) => void): void;
}
