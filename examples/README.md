## Preparation

```bash
$ export WSDEV=/dev/tty.usbserialxxx
$ export WSID=YOUR_ID
$ export WSPWD=YOUR_PASSWORD
$ export WSDESC='{"channel":59,"panId":4068,"addr":"38E08E0000123456"}' // optional
```

## example1
```bash
$ node_modules/.bin/ts-node examples/example1.ts
example1: {"channel":59,"page":9,"panId":4068,"addr":"38E08E0000123456","LQI":101,"pairId":"12345678"}
example1: done
$
```

## example2
```bash
$ node_modules/.bin/ts-node examples/example2.ts
example2: finding ...
example2: found a device {"channel":59,"page":9,"panId":4068,"addr":"38E08E0000123456","LQI":106,"pairId":"12345678"}
example2: the instance is 028801
example2: done
$
```

- In order to bypass scanning node phase,
you can specify the descriptor if you already know it.

```bash
$ export WSDESC='{"channel":59,"panId":4068,"addr":"38E08E0000123456"}'
$
$ node_modules/.bin/ts-node examples/example2.ts
example2: finding ...
example2: found a device {"channel":59,"page":9,"panId":4068,"addr":"38E08E0000123456","LQI":106,"pairId":"12345678"}
example2: the instance list is 108108ca0ef0010ef0017301d50401028801
example2: done
$
```

## example3
```bash
$ node_modules/.bin/ts-node examples/example3.ts
example3: finding ...
example3: found a device {"channel":59,"page":9,"panId":4068,"addr":"38E08E0000123456","LQI":106,"pairId":"12345678"}
example3: hit any key to end
example3: 8:50 AM 622watt 622(min)/622(max)
example3: 8:51 AM 1024watt 622(min)/1024(max)
example3: 8:52 AM 1203watt 622(min)/1203(max)
<hit a key>
example3: done
$
```
