const EventEmitter = require('events'),

    bridge = require('./bridge'),
    { isFunction, isObject } = require('./utils'),

    /**
     * The time to wait for UVM boot to finish. In milliseconds.
     *
     * @private
     * @type {Number}
     */
    DEFAULT_BOOT_TIMEOUT = 30 * 1000,

    E = '',
    ERROR_EVENT = 'error',
    DISPATCH_QUEUE_EVENT = 'dispatchQueued';

/**
 * Configuration options for  UniversalVM connection.
 *
 * @typedef UniversalVM.connectOptions
 *
 * @property {Boolean} [bootCode] Code to be executed inside a VM on boot
 * @property {Boolean} [_sandbox] Custom sandbox instance
 * @property {Boolean} [debug] Enable global console object in Node.js worker thread or Web Worker
 * @property {Boolean} [bootTimeout=30 * 1000] The time (in milliseconds) to wait for UVM boot to finish
 */

/**
 * Universal Virtual Machine for Node and Browser.
 */
class UniversalVM extends EventEmitter {
    constructor () {
        super();

        /**
         * Boolean representing the bridge connectivity state.
         *
         * @private
         * @type {Boolean}
         */
        this._bridgeConnected = false;

        /**
         * Stores the pending dispatch events until the context is ready for use.
         * Useful when not using the asynchronous construction.
         *
         * @private
         * @type {Array}
         */
        this._dispatchQueue = [];
    }

    /**
     * Creates a new instance of UniversalVM.
     * This is merely an alias of the construction creation without needing to
     * write the `new` keyword and creating explicit connection.
     *
     * @param {UniversalVM.connectOptions} [options] Options to configure the UVM
     * @param {Function(error, context)} callback Callback function
     * @returns {Object} UVM event emitter instance
     *
     * @example
     * const uvm = require('uvm');
     *
     * uvm.spawn({
     *     bootCode: `
     *         bridge.on('loopback', function (data) {
     *             bridge.dispatch('loopback', 'pong');
     *         });
     *     `
     * }, (err, context) => {
     *     context.on('loopback', function (data) {
     *         console.log(data); // pong
     *     });
     *
     *     context.dispatch('loopback', 'ping');
     * });
     */
    static spawn (options, callback) {
        const uvm = new UniversalVM();

        // connect with the bridge
        uvm.connect(options, callback);

        // return event emitter for chaining
        return uvm;
    }

    /**
     * Establish connection with the communication bridge.
     *
     * @param {UniversalVM.connectOptions} [options] Options to configure the UVM
     * @param {Function(error, context)} callback Callback function
     */
    connect (options, callback) {
        // set defaults for parameters
        !isObject(options) && (options = {});

        /**
         * Wrap the callback for unified result and reduce chance of bug.
         * We also abandon all dispatch replay.
         *
         * @private
         * @param  {Error=} [err] -
         */
        const done = (err) => {
            if (err) {
                // on error during bridging, we simply abandon all dispatch replay
                this._dispatchQueue.length = 0;

                try { this.emit(ERROR_EVENT, err); }
                // nothing to do if listeners fail, we need to move on and execute callback!
                catch (e) { } // eslint-disable-line no-empty
            }

            isFunction(callback) && callback(err, this);
        };

        // bail out if bridge is connected
        if (this._bridgeConnected) {
            return done();
        }

        // start connection with the communication bridge
        this._bridgeConnected = true;

        // we bridge this event emitter with the context (bridge usually creates the context as well)
        bridge(this, Object.assign({ // eslint-disable-line prefer-object-spread
            bootCode: E,
            bootTimeout: DEFAULT_BOOT_TIMEOUT
        }, options), (err) => {
            if (err) {
                return done(err);
            }

            let args;

            try {
                // we dispatch all pending messages provided nothing had errors
                while ((args = this._dispatchQueue.shift())) {
                    // one bad message must not drop the rest, same as a dispatch after connect
                    try { this._dispatch(...args); }
                    catch (e) { this.emit(ERROR_EVENT, e); }
                }
            }
            // since there us no further work after dispatching events, we re-use the err parameter.
            // at this point err variable is falsy since truthy case is already handled before
            catch (e) { /* istanbul ignore next */ err = e; }

            done(err);
        });
    }

    /**
     * Emit an event on the other end of bridge.
     * The parameters are same as `emit` function of the event emitter.
     */
    dispatch () {
        try { this._dispatch(null, ...arguments); }
        catch (e) { /* istanbul ignore next */ this.emit(ERROR_EVENT, e); }
    }

    /**
     * Same as `dispatch`, but also moves the given binary buffers to the other end of the bridge instead of copying
     * them. Listeners there receive them as an Array of Uint8Array, after the event arguments.
     * A transferred buffer is detached on this end: pass a copy to keep using yours.
     * Unlike `dispatch`, a message that cannot be sent throws instead of emitting `error`, so the caller can fail the
     * work it was sending; one queued before connect still reports through `error`.
     *
     * @param {Array.<ArrayBuffer|ArrayBufferView>} buffers - Binary data to transfer
     * @param {String} name - Event name
     * @param {...*} args - Event arguments
     * @throws {TypeError} If `buffers` is not an Array
     */
    dispatchTransfer (buffers, name, ...args) {
        if (!Array.isArray(buffers)) {
            throw new TypeError('uvm: dispatchTransfer expects an Array of buffers');
        }

        this._dispatch(buffers, name, ...args);
    }

    /**
     * Disconnect the bridge and release memory.
     */
    disconnect () {
        // reset the bridge connection state
        this._bridgeConnected = false;

        try { this._disconnect(...arguments); }
        catch (e) { this.emit(ERROR_EVENT, e); }
    }

    /**
     * Stub dispatch handler to queue dispatched messages until bridge is ready.
     *
     * @private
     * @param {Array|null} buffers -
     * @param {String} name -
     */
    _dispatch (buffers, name) {
        this._dispatchQueue.push(arguments);
        this.emit(DISPATCH_QUEUE_EVENT, name);
    }

    /**
     * The bridge should be ready to disconnect when this is called. If not,
     * then this prototype stub would throw an error
     *
     * @private
     * @throws {Error} If bridge is not ready and this function is called
     */
    _disconnect () { // eslint-disable-line class-methods-use-this
        throw new Error('uvm: cannot disconnect, communication bridge is broken');
    }
}

module.exports = UniversalVM;
