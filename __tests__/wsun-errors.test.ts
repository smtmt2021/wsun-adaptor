/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { WsunCommandError } from '../src/wsun-errors';

test('WsunCommandError', () => {
  expect(new WsunCommandError(0)).toMatchSnapshot();
  expect(new WsunCommandError(1)).toMatchSnapshot();
  expect(new WsunCommandError(2)).toMatchSnapshot();
  expect(new WsunCommandError(3)).toMatchSnapshot();
  expect(new WsunCommandError(4)).toMatchSnapshot();
  expect(new WsunCommandError(5)).toMatchSnapshot();
  expect(new WsunCommandError(6)).toMatchSnapshot();
  expect(new WsunCommandError(7)).toMatchSnapshot();
  expect(new WsunCommandError(8)).toMatchSnapshot();
  expect(new WsunCommandError(9)).toMatchSnapshot();
  expect(new WsunCommandError(10)).toMatchSnapshot();
  expect(new WsunCommandError(NaN)).toMatchSnapshot();
});
