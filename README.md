[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/smtmt2021/wsun-adaptor/workflows/Node.js%20CI/badge.svg)](https://github.com/smtmt2021/wsun-adaptor/actions?query=workflow%3A%22Node.js+CI%22)

# WSUN Adaptor Interface

It provides an interface to WSUN adaptor,
and act as PaC in order to access a remote PAA coordinator.

```
+-------------------------------------------+
|                 Your Apps                 |
+-------------------------------------------+
|       >>> WSUN Adaptor Interface <<<      |
+-------------------------------------------+
|                          |  UDP  |  PANA  |
|        WSUN Adaptor      | IPv6 / 6LoWPAN |
|                          |  IEEE802.15.4  |
+-------------------------------------------+
                       :
+-------------------------------------------+
|         A smart meter of your home        |
+-------------------------------------------+
```

## Usage

```typescript
// Let's start!
const adaptor = WsunGetAdaptor('a model name of adaptor, e.g. BP35A1');
// find and connect a remote PAA coordinator
const descriptor = 
  await adaptor.open('/dev/serialport', {id: 'your id', password: 'your password'});
// make a socket to communicate with remote devices
const socket = adaptor.createSocket();
// wait for messages from remote devices
socket.on('message', (msg, rinfo) => {
  console.log(`received ${msg.toString()} from ${rinfo.address}`);
});
await socket.bind(3610);
// send a message to a remote device
await socket.send(Buffer.from('1081...', 'hex'), 3610, descriptor.addr);
// end of communication
await socket.close();
await adaptor.close();
```
- see [`./examples`](./examples) as well.

## Test

- `npm test`
- open `./coverage/lcov-report/index.html` to see the coverage.

## Debug

- Specify following environment variables (e.g. `export DEBUG=wsun/adaptor`) to display debug information;

File or module                    | Environment variable
----------------------------------|---------------------
`src/wsun-bp35a1.ts`              | `wsun/adaptor`
`src/wsun-socket.ts`              | `wsun/socket`
`wsun-adaptor-mock`               | `wsun/robot`
`serialport`                      | e.g. `serialport/stream`

- see [visionmedia/debug](https://github.com/visionmedia/debug#readme) in details, and [SerialPort](https://serialport.io/docs/guide-debugging) as well.

## Build
- `npm run build`

## Supported adaptor

| Model name | Manufacturer
-------------|-------------
| `BP35A1`   | ROHM

## License
- MIT license
- Copyright (c) KINOSHITA minoru <smtmt2021@gmail.com>, All Rights Reserved.
