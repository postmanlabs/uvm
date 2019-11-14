[![Build Status](https://travis-ci.com/coditva/uvm.svg?branch=develop)](https://travis-ci.com/coditva/uvm)
[![codecov](https://codecov.io/gh/coditva/uvm/branch/develop/graph/badge.svg)](https://codecov.io/gh/coditva/uvm)

# uvm

Module that exposes an event emitter to send data across contexts (vm in node and iframe in browser)

## Usage

```
var uvm = require('uvm');

uvm.createHost({
    bootTimeout: 30 * 1000, // default 30s. set `undefined` for Infinity
    bootCode: `bridge.on('ping', function () {
        bridge.send('pong', Date.now())
    });`
}, function (err, bridge) {

    bridge.on('pong', console.log);
    bridge.send('ping');
});
```
