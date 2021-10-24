/**
 * @license MIT License
 * @copyright KINOSHITA minoru, All Rights Reserved.
 */
import { PanDescriptor } from '../src/wsun-pandescriptor';

test('PanDescriptor', () => {
  const descriptor = new PanDescriptor();
  expect(descriptor.isValid).toBeFalsy();

  descriptor.channel = 'nan';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.page = 'nan';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.panId = 'nan';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.addr = 'address';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.LQI = 'nan';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.pairId = 'pair id';
  expect(descriptor.isValid).toBeFalsy();

  descriptor.channel = '1';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.page = '22';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.panId = '333';
  expect(descriptor.isValid).toBeFalsy();
  descriptor.LQI = '4444';
  expect(descriptor.isValid).toBeTruthy();

  descriptor.reset();
  expect(descriptor.isValid).toBeFalsy();
});
