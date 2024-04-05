/* istanbul ignore file */

const Flatted = require('flatted'),
    { randomNumber } = require('./utils'),
    { Worker } = require('worker_threads'),

    // code for bridge
    bridgeClientCode = require('./bridge-client'),

    ERROR = 'error',
    MESSAGE = 'message',
    UVM_ID_ = '__id_uvm_',
    MESSAGE_ERROR = 'messageerror',
    UNCAUGHT_EXCEPTION = 'uncaughtException',

    // code to catch uncaught exceptions and re-emit
    // them for consumers to process the error.
    // if no listener is attached for uncaughtException
    // event, it will throw the error and terminate the worker.
    UNCAUGHT_EXCEPTION_HANDLER = `
        ;(function (bridge) {
            process.on('${UNCAUGHT_EXCEPTION}', function (e) {
                if (bridge.listeners('${UNCAUGHT_EXCEPTION}').length) {
                    return bridge.emit('${UNCAUGHT_EXCEPTION}', e);
                }

                throw e;
            });
        })(bridge);
    `,

    /**
     * Returns the firmware code to be executed inside Worker thread.
     *
     * @private
     * @param {String} code -
     * @param {String} id -
     * @return {String}
     */
    sandboxFirmware = (code, id) => {
        return `
            __parentPort = require('worker_threads').parentPort;
            __uvm_emit = function (parentPort, args) {
                parentPort.postMessage({__id_uvm: "${id}",__emit_uvm: args});
            }.bind(null, __parentPort);
            __uvm_addEventListener = __parentPort.on.bind(__parentPort);
            __parentPort = null; delete __parentPort;
            ${code}
            (function (emit, id) {
                __uvm_addEventListener("message", function (m) {
                    (m && (typeof m.__emit_uvm === 'string') && (m.__id_uvm === id)) &&
                        emit(m.__emit_uvm);
                });
            }(__uvm_dispatch, "${id}"));
            __uvm_emit('${Flatted.stringify(['load.' + id])}');
            __uvm_dispatch = null; __uvm_emit = null; __uvm_addEventListener = null;
            delete __uvm_dispatch; delete __uvm_emit; delete __uvm_addEventListener;
        `;
    };

module.exports = function (bridge, options, callback) {
    let worker,
        bootTimer,
        firmwareCode;

    const id = UVM_ID_ + randomNumber(),

        // We append the uncaught exception handler before the
        // provided bootCode to ensure that the handler has
        // access to `bridge` and other global values before
        // the boot code mutates them (if at all).
        safeBootCode = UNCAUGHT_EXCEPTION_HANDLER + options.bootCode,

        // function to forward messages emitted
        forwardEmits = (m) => {
            if (!(m && (typeof m.__emit_uvm === 'string') && (m.__id_uvm === id))) { return; }

            let args;

            try { args = Flatted.parse(m.__emit_uvm); }
            catch (err) { return bridge.emit(ERROR, err); }
            bridge.emit(...args);
        },

        // function to forward errors emitted
        forwardErrors = (e) => {
            bridge.emit(ERROR, e);
        },

        // function to terminate worker
        terminateWorker = function (callback) {
            if (!worker) { return; }

            // remove event listeners for this sandbox
            worker.off(MESSAGE, forwardEmits);
            worker.off(ERROR, forwardErrors);
            worker.off(MESSAGE_ERROR, forwardErrors);

            if (!options._sandbox) {
                worker.terminate().then((exitCode) => {
                    worker = null;
                    callback && callback(exitCode);
                });
            }
            else {
                worker = null;
            }
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
    firmwareCode = sandboxFirmware(bridgeClientCode(safeBootCode), id);

    // start boot timer, stops once we get the load signal, terminate otherwise
    bootTimer = setTimeout(() => {
        terminateWorker(() => {
            callback(new Error(`uvm: boot timed out after ${options.bootTimeout}ms.`));
        });
    }, options.bootTimeout);

    // if sandbox worker is provided, we simply need to init with firmware code
    // @todo validate sandbox type or APIs
    if (options._sandbox) {
        worker = options._sandbox;
        worker.postMessage({ __init_uvm: firmwareCode });
    }
    // else, spawn a new worker
    else {
        worker = new Worker(firmwareCode, {
            eval: true,
            stdout: !options.debug,
            stderr: !options.debug
        });
    }

    // add event listener for receiving events
    // from worker (is removed on disconnect)
    worker.on(MESSAGE, forwardEmits);
    worker.on(ERROR, forwardErrors);
    worker.on(MESSAGE_ERROR, forwardErrors);

    // equip bridge to disconnect (i.e. terminate the worker)
    bridge._disconnect = terminateWorker;

    // help GC collect large variables
    firmwareCode = null;
};
