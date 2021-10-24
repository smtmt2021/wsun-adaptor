/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunId, WsunPanDesc, WsunSocket } from './';
import { WsunCache } from './wsun-interfaces';

export type WsunEventSession =
  | 'session-established'
  | 'session-ending'
  | 'session-ended'
  | 'session-error'
  | 'session-timeout'
  | 'session-108-start'
  | 'session-108-end';

export interface WsunAdaptor {
  /**
   *  Start activities with a wsun adaptor
   *  and establish a connection with PAA coordinator.
   *  @param  wsunId  ID & password
   *  @param  cache   cache info
   *  @returns  a descriptor of the connected PAA coordinator,
   *            undefined if no PAA coordinator was found.
   */
  open(wsunId: WsunId, cache?: WsunCache): Promise<WsunPanDesc | undefined>;

  /**
   *  Terminate a connection with a PAA coordinator
   */
  close(): Promise<void>;

  /**
   *  Check if connection with wsun adaptor.
   *  @return true if the connection is online.
   */
  isOnline(): boolean;

  /**
   *  Create a socket to communicate remote node.
   *  @return a socket.
   */
  createSocket(): WsunSocket;

  /**
   * Add a listener for the event
   * @param en
   * @param listener
   * @event 'session-established' a PANA session is established
   * @event 'session-ending'      receive a PANA session end request
   * @event 'session-ended'       a PANA session is ended
   * @event 'session-error'       a PANA session is ended due to error
   * @event 'session-timeout'     a PANA session is ended due to timeout
   * @event 'session-108-start'   Restriction of ARIB 108 is started
   * @event 'session-108-end'     Restriction of ARIB 108 is ended
   */
  on(en: WsunEventSession, listener: () => void): void;
}
