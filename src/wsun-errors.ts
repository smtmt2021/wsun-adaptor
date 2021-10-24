/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
export class WsunError extends Error {
  constructor(message: string) {
    super('wsun: ' + message);
    this.name = new.target.name;
  }
}

export class WsunUdpTransmissionFailed extends WsunError {
  constructor() {
    super("wsun adaptor replied 'udp transmission failed'");
    this.name = new.target.name;
  }
}

export class WsunSendingInProgress extends WsunError {
  constructor() {
    super('wsun is sending in progress');
    this.name = new.target.name;
  }
}

export class WsunCommandError extends WsunError {
  private static reason2message(reason: number): string {
    switch (reason) {
      case 4:
        return "wsun adaptor replied 'unsupported command'";
      case 5:
        return "wsun adaptor replied 'incorrect command'";
      case 6:
        return "wsun adaptor replied 'incorrect range'";
      case 9:
        return "wsun adaptor replied 'uart error'";
      case 10:
        return "wsun adaptor replied 'failed to get result'";
      default:
        return "wsun adaptor replied 'unknown error'";
    }
  }

  constructor(public reason: number) {
    super(WsunCommandError.reason2message(reason));
    this.name = new.target.name;
  }
}

export class WsunTimeoutError extends WsunError {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
