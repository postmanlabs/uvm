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
        __uvm_addEventListener = __self.addEventListener.bind(__self);

        ${bridgeClientCode()}

        (function (emit, id) {
            __uvm_addEventListener("message", function (e) {
                const { __emit_uvm, __id_uvm } = e?.data || e || {};
                if (typeof __emit_uvm === 'string' && __id_uvm === id) {
                    emit(__emit_uvm);
                }
            });
        }(__uvm_dispatch, "${id}"));
        __uvm_dispatch = null; delete __uvm_dispatch;
        __uvm_addEventListener = null; delete __uvm_addEventListener;

        (function (self, bridge, setTimeout) {
            ${Worker.__exceptionHandler}
        })(__self, bridge, setTimeout);
        __self = null; delete __self;

        // boot code starts hereafter
        __uvm_setTimeout = setTimeout;
        try {
            ${bootCode};
        } catch (error) {
            __uvm_setTimeout(() => { throw error; }, 0);
        }

        __uvm_emit('${Flatted.stringify(['load.' + id])}');
        __uvm_emit = null; delete __uvm_emit;
        __uvm_setTimeout = null; delete __uvm_setTimeout;
        `;
    };

module.exports = function (bridge, options, callback) {
    let worker,
        bootTimer,
        firmwareCode;

    const id = UVM_ID_ + randomNumber(),

        // function to forward messages emitted
        forwardEmits = (e) => {
            // e.data for Web Worker (MessageEvent.data)
            const { __emit_uvm, __id_uvm } = e?.data || e || /* istanbul ignore next */ {};

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
            worker.removeEventListener(MESSAGE, forwardEmits);
            worker.removeEventListener(ERROR, forwardErrors);
            worker.removeEventListener(MESSAGE_ERROR, forwardErrors);
            worker.removeEventListener(EXIT, forwardExit);

            const terminate = !options._sandbox ?
                worker.terminate.bind(worker, callback) :
                callback;

            worker = null;
            terminate && terminate();
        };

    // on load attach the dispatcher
    bridge.once('load.' + id, () => {
        // stop boot timer first
        clearTimeout(bootTimer);

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
    });

    // get firmware code string with boot code
    firmwareCode = sandboxFirmware(options.bootCode, id, options.debug);

    // start boot timer, stops once we get the load signal, terminate otherwise
    bootTimer = setTimeout(() => {
        terminateWorker();
        callback(new Error(`uvm: boot timed out after ${options.bootTimeout}ms.`));
    }, options.bootTimeout);

    // if sandbox worker is provided, we simply need to init with firmware code
    // @todo validate sandbox type or APIs
    if (options._sandbox) {
        worker = options._sandbox;

        /* istanbul ignore else */
        if (typeof worker.addEventListener !== 'function') {
            // add event listener methods for Node.js worker
            worker.addEventListener = worker.on.bind(worker);
            worker.removeEventListener = worker.off.bind(worker);
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
    worker.addEventListener(MESSAGE, forwardEmits);
    worker.addEventListener(ERROR, forwardErrors);
    worker.addEventListener(MESSAGE_ERROR, forwardErrors);
    worker.addEventListener(EXIT, forwardExit);

    // equip bridge to disconnect (i.e. terminate the worker)
    bridge._disconnect = terminateWorker;

    // help GC collect large variables
    firmwareCode = null;
};
