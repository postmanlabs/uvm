# uvm

Module that exposes an event emitter to send data across contexts (vm in node and iframe in browser)

## Usage

```
var uvm = require('uvm');

uvm.createHost({
    bootstrap: `bridge.on('ping', function () {
        bridge.send('pong', Date.now())
    });'
}, function (err, bridge) {

    bridge.on('pong', console.log);
    bridge.send('ping');
});
```
