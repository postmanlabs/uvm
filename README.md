# UVM [![CI](https://github.com/postmanlabs/uvm/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/postmanlabs/uvm/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/postmanlabs/uvm/branch/develop/graph/badge.svg)](https://codecov.io/gh/postmanlabs/uvm)

Module that exposes an event emitter to send data across contexts ([Worker threads](https://nodejs.org/api/worker_threads.html) in Node.js and [Web Workers](https://www.w3.org/TR/workers/) in browser).

## Installation
UVM can be installed using NPM or directly from the git repository within your NodeJS projects. If installing from NPM, the following command installs the module and saves in your `package.json`

```console
$ npm install uvm --save
```

## Usage

```javascript
let uvm = require('uvm'),
    context;

context = uvm.spawn({
    bootCode: `
        bridge.on('loopback', function (data) {
            bridge.dispatch('loopback', data + ' World!');
        });
    `
});

context.on('loopback', function (data) {
    console.log(data); // Hello World!
});

context.dispatch('loopback', 'Hello');
```
