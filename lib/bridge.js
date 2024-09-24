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
                const { __emit_uvm, __id_uvm } = e || {};
                if (typeof __emit_uvm === 'string' && __id_uvm === id) {
                    emit(__emit_uvm);
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
