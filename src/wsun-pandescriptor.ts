/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunPanDesc } from './';

export class PanDescriptor {
  private descriptor = {} as WsunPanDesc;

  reset(): void {
    this.descriptor = {} as WsunPanDesc;
  }

  get isValid(): boolean {
    return !(this.descriptor.channel == null
      || this.descriptor.page == null
      || this.descriptor.panId == null
      || this.descriptor.addr == null
      || this.descriptor.LQI == null
      || this.descriptor.pairId == null
    );
  }

  set channel(arg: string) {
    const channel = parseInt(arg, 16);
    if (!isNaN(channel)) this.descriptor.channel = channel;
  }

  set page(arg: string) {
    const page = parseInt(arg, 16);
    if (!isNaN(page)) this.descriptor.page = page;
  }

  set panId(arg: string) {
    const panId = parseInt(arg, 16);
    if (!isNaN(panId)) this.descriptor.panId = panId;
  }

  set addr(arg: string) {
    this.descriptor.addr = arg;
  }

  set LQI(arg: string) {
    const LQI = parseInt(arg, 16);
    if (!isNaN(LQI)) this.descriptor.LQI = LQI;
  }

  set pairId(arg: string) {
    this.descriptor.pairId = arg;
  }

  getDescriptor(): WsunPanDesc {
    const descriptor = Object.assign({}, this.descriptor);
    this.reset();
    return descriptor;
  }

  toString(): string {
    return JSON.stringify(this.descriptor);
  }
}
