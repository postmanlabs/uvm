/*
 * @note
 * options.bootTimeout is not implemented in browser sandbox because there is no way to interrupt an infinite loop.
 */
var uuid = require('uuid'),
    Flatted = require('flatted'),
    MESSAGE = 'message',
    ERROR = 'error',

    // code for bridge
    bridgeClientCode = require('./bridge-client'),

    /**
     * Returns the firmware code to be executed inside Web Worker.
     *
     * @param {String} code
     * @param {String} id
     * @return {String}
     */
    sandboxFirmware = function (code, id) {
        // @note self.postMessage and self.addEventListener methods are cached
        // in variable or closure because bootCode might mutate the global scope
        return `
            __uvm_emit = function (postMessage, args) {
                postMessage({__id_uvm: "${id}",__emit_uvm: args});
            }.bind(null, self.postMessage);
            __uvm_addEventListener = self.addEventListener;
            try {${code}} catch (e) { setTimeout(function () { throw e; }, 0); }
            (function (emit, id) {
                __uvm_addEventListener("message", function (e) {
                    (e && e.data && (typeof e.data.__emit_uvm === 'string') && (e.data.__id_uvm === id)) &&
                        emit(e.data.__emit_uvm);
                });
            }(__uvm_dispatch, "${id}"));
            __uvm_emit('${Flatted.stringify(['load.' + id])}');
            __uvm_dispatch = null; __uvm_emit = null; __uvm_addEventListener = null;
        `;
    };

module.exports = function (bridge, options, callback) {
    if (!(Blob && Worker && window && window.URL && window.URL.createObjectURL)) {
        return callback(new Error('uvm: unable to setup communication bridge, missing required APIs'));
    }

    var id = uuid(),
        firmwareCode = sandboxFirmware(bridgeClientCode(options.bootCode), id),
        firmwareObjectURL,
        worker,

        // function to forward messages emitted
        forwardEmits = function (e) {
            if (!(e && e.data && (typeof e.data.__emit_uvm === 'string') && (e.data.__id_uvm === id))) { return; }

            var args;
            try { args = Flatted.parse(e.data.__emit_uvm); }
            catch (err) { return bridge.emit(ERROR, err); }
            bridge.emit.apply(bridge, args); // eslint-disable-line prefer-spread
        },

        // function to forward errors emitted
        forwardErrors = function (e) {
            bridge.emit(ERROR, e);
        },

        processCallback = function () {
            bridge._dispatch = function () {
                if (!worker) {
                    return bridge.emit(ERROR,
                        new Error('uvm: unable to dispatch "' + arguments[0] + '" post disconnection.'));
                }

                worker.postMessage({
                    __emit_uvm: Flatted.stringify(Array.prototype.slice.call(arguments)),
                    __id_uvm: id
                });
            };

            callback(null, bridge);
        };

    // if sandbox worker is provided, we simply need to init with firmware code
    // @todo validate sandbox type or APIs
    if (options._sandbox) {
        worker = options._sandbox;
        worker.postMessage({ __init_uvm: firmwareCode });
    }
    // else, spawn a new worker
    else {
        // convert the firmware code into a blob URL
        firmwareObjectURL = window.URL.createObjectURL(
            new Blob([firmwareCode], { type: 'text/javascript' })
        );

        worker = new Worker(firmwareObjectURL);
    }

    // on load attach the dispatcher
    bridge.once('load.' + id, processCallback);

    // add event listener for receiving events from worker (is removed on disconnect)
    // don't set `onmessage` and `onerror` as it might override external sandbox
    worker.addEventListener(MESSAGE, forwardEmits);
    worker.addEventListener(ERROR, forwardErrors);

    // equip bridge to disconnect (i.e. terminate the worker)
    bridge._disconnect = function () {
        if (!worker) { return; }

        // remove event listeners for this sandbox
        worker.removeEventListener(MESSAGE, forwardEmits);
        worker.removeEventListener(ERROR, forwardErrors);

        // do not terminate sandbox worker if not spawned for the bridge
        if (!options._sandbox) {
            worker.terminate();

            // revoke after termination. otherwise, blob reference is retained until GC
            // refer: "chrome://blob-internals"
            window.URL.revokeObjectURL(firmwareObjectURL);
        }

        worker = null;
    };

    // help GC collect large variables
    firmwareCode = null;
};
