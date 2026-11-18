const Flatted = require('flatted'),
    { randomNumber } = require('./utils'),
    Worker = require('./worker'),

    // code for bridge
    bridgeClientCode = require('./bridge-client'),

    EXIT = 'exit',
    ERROR = 'error',
    MESSAGE = 'message',
    UVM_ID_ = '__id_uvm_',
    MESSAGE_ERROR = 'messageerror',

    /**
     * Returns the firmware code to be executed inside Worker thread.
     *
     * @private
     * @param {String} bootCode -
     * @param {String} id -
     * @param {Boolean} debug -
     * @return {String}
     */
    sandboxFirmware = (bootCode, id, debug = false) => {
        return `
        !${debug} && (console = new Proxy({}, { get: function () { return function () {}; } }));
        __self = ${Worker.__self};
        __uvm_emit = function (postMessage, args) {
            postMessage({__id_uvm: "${id}", __emit_uvm: args});
        }.bind(null, __self.postMessage.bind(__self));
        __uvm_on = __self.on.bind(__self);

        ${bridgeClientCode()}

        (function (emit, id) {
            __uvm_on("message", function (e) {
                const { __emit_uvm, __id_uvm, __bin_uvm } = e || {};
                if (typeof __emit_uvm === 'string' && __id_uvm === id) {
                    emit(__emit_uvm, __bin_uvm);
                }
            });
        }(__uvm_dispatch, "${id}"));
        __uvm_dispatch = null; delete __uvm_dispatch;
        __uvm_on = null; delete __uvm_on;

        (function (self, bridge, setTimeout) {
            ${Worker.__exceptionHandler}
        })(__self, bridge, setTimeout);
        __self = null; delete __self;

        // boot code starts hereafter
        __uvm_setTimeout = setTimeout;
        try {
            ${Worker.__bootCodeExecutor(bootCode)};
        } catch (error) {
            __uvm_setTimeout(() => { throw error; }, 0);
        }

        __uvm_emit('${Flatted.stringify(['load.' + id])}');
        __uvm_emit = null; delete __uvm_emit;
        __uvm_setTimeout = null; delete __uvm_setTimeout;
        `;
    },

    /**
     * Returns a Uint8Array that can be transferred without detaching anything else: a view over part of an
     * ArrayBuffer (like a pooled Buffer) is copied into one of its own. Shared memory, and memory from another
     * realm (like an iframe), is kept as is and sent as a copy.
     *
     * @private
     * @param {ArrayBuffer|ArrayBufferView} data -
     * @return {Uint8Array}
     */
    toOwnedView = (data) => {
        if (!ArrayBuffer.isView(data)) {
            const tag = Object.prototype.toString.call(data);

            if (tag !== '[object ArrayBuffer]' && tag !== '[object SharedArrayBuffer]') {
                throw new TypeError('uvm: dispatchTransfer expects ArrayBuffers or ArrayBuffer views');
            }

            return new Uint8Array(data);
        }

        const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        return (!(view.buffer instanceof ArrayBuffer) ||
            (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength)) ? view : new Uint8Array(view);
    },

    /**
     * Returns the distinct ArrayBuffers behind the views. Shared memory is shared, not transferred.
     *
     * @private
     * @param {Array.<Uint8Array>} views -
     * @return {Array.<ArrayBuffer>}
     */
    transferList = (views) => {
        return [...new Set(views.map((view) => { return view.buffer; }))]
            .filter((buffer) => { return buffer instanceof ArrayBuffer; });
    };

module.exports = function (bridge, options, callback) {
    let worker,
        bootTimer,
        firmwareCode;

    const id = UVM_ID_ + randomNumber(),
        { bootCode, debug, bootTimeout, _sandbox } = options,

        // function to forward messages emitted
        forwardEmits = (e) => {
            const { __emit_uvm, __id_uvm } = e;

            /* istanbul ignore next-line */
            if (!(typeof __emit_uvm === 'string' && __id_uvm === id)) { return; }

            try { bridge.emit(...Flatted.parse(__emit_uvm)); }
            catch (err) {
                /* istanbul ignore next-line */
                return bridge.emit(ERROR, err);
            }
        },

        // function to forward errors emitted
        forwardErrors = (e) => {
            bridge.emit(ERROR, e);
        },

        // NOTE: This only get called in case of Node worker.
        // Web worker dispatches a synthetic `exit` event, directly on `bridge`.
        forwardExit = () => {
            bridge.emit(EXIT);
        },

        // function to terminate worker
        terminateWorker = function (callback) {
            /* istanbul ignore next-line */
            if (!worker) { return; }

            // remove event listeners for this sandbox
            worker.off(MESSAGE, forwardEmits);
            worker.off(ERROR, forwardErrors);
            worker.off(MESSAGE_ERROR, forwardErrors);
            worker.off(EXIT, forwardExit);


            (_sandbox ? Promise.resolve() : worker.terminate())
                .then(() => { callback(); });
            worker = null;
        };

    // on load attach the dispatcher
    bridge.once('load.' + id, () => {
        // stop boot timer first
        clearTimeout(bootTimer);

        bridge._dispatch = function (buffers) {
            if (!worker) {
                const error = new Error('uvm: unable to dispatch "' + arguments[1] + '" post disconnection.');

                // a transfer throws like any other send error, see `dispatchTransfer`
                if (buffers) { throw error; }

                return bridge.emit(ERROR, error);
            }

            const message = {
                __emit_uvm: Flatted.stringify(Array.prototype.slice.call(arguments, 1)),
                __id_uvm: id
            };

            if (!buffers) {
                return worker.postMessage(message);
            }

            message.__bin_uvm = buffers.map(toOwnedView);
            worker.postMessage(message, transferList(message.__bin_uvm));
        };

        callback(null, bridge);
    });

    // get firmware code string with boot code
    firmwareCode = sandboxFirmware(bootCode, id, debug);

    // start boot timer, stops once we get the load signal, terminate otherwise
    bootTimer = setTimeout(() => {
        terminateWorker();
        callback(new Error(`uvm: boot timed out after ${bootTimeout}ms.`));
    }, bootTimeout);

    // if sandbox worker is provided, we simply need to init with firmware code
    // @todo validate sandbox type or APIs
    if (_sandbox) {
        worker = _sandbox;

        // add event listener methods for Web worker
        /* istanbul ignore next-line */
        if (typeof worker.on !== 'function') {
            Worker.attachNodeStyleListener(worker);
        }

        worker.postMessage({ __init_uvm: firmwareCode });
    }
    // else, spawn a new worker
    else {
        try { worker = new Worker(firmwareCode, options); }
        catch (error) {
            /* istanbul ignore next-line */
            return callback(new Error(`uvm: unable to spawn worker.\n${error.message || error}`));
        }
    }

    // add event listener for receiving events
    // from worker (is removed on disconnect)
    worker.on(MESSAGE, forwardEmits);
    worker.on(ERROR, forwardErrors);
    worker.on(MESSAGE_ERROR, forwardErrors);
    worker.on(EXIT, forwardExit);

    // equip bridge to disconnect (i.e. terminate the worker)
    bridge._disconnect = terminateWorker;

    // help GC collect large variables
    firmwareCode = null;
};
