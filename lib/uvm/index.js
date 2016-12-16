var _ = require('lodash'),
    inherits = require('inherits'),
    EventEmitter = require('events'),
    bridge = require('./bridge'),

    ERROR_EVENT = 'error',
    DISPATCHQUEUE_EVENT = 'dispatchQueued',
    DISCONNECT_ERROR_MESSAGE = 'uvm: cannot disconnect, communication bridge is broken',

    UniversalVM;

/**
 * @constructor
 * @extends {EventEmitter}
 * @param {Object} options
 * @param {String} options.bootcode
 * @param {Function} callback
 */
UniversalVM = function UniversalVM (options, callback) {
    // set defaults for parameters
    !_.isObject(options) && (options = {});

    // call the super constructor
    EventEmitter.call(this);

    /**
     * Wrap the callback for unified result and reduce chance of bug.
     * We also abandon all dispatch replay
     * @param  {Error=} [err]
     */
    var done = function (err) {
        if (err) {
            this._pending.length = 0;

            try { this.emit(ERROR_EVENT, err); }
            // nothing to do if listeners fail, we need to move on and execute callback!
            catch (e) { } // eslint-disable-line no-empty
        }

        _.isFunction(callback) && callback.call(this, err, this);
    }.bind(this);

    /**
     * Stores the pending dispatch events until the context is ready for use. Useful when not using the asynchronous
     * construction.
     *
     * @private
     * @memberOf UniversalVM.prototype
     * @type {Array}
     *
     * @todo clear wasted pending messages post context initialization error
     */
    this._pending = [];

    // we bridge this event emitter with the context (bridge usually creates the context as well)
    bridge(this, _.defaults(options, {}), function (err) {
        // on error during bridging, we simply abandon all dispatch replay and bail out through callback
        if (err) {
            this._pending.length = 0;
            return done(err);
        }

        var args;

        try {
            // we dispatch all pending messages provided nothing had errors
            while ((args = this._pending.shift())) {
                this.dispatch.apply(this, args);
            }
        }
        // since there us no further work after dispatching events, we re-use the err parameter.
        // at this point err variable is falsey since truthy case is already handled before
        catch (e) { err = e; }

        done(err);
    }.bind(this));
};

// make UVM inherit from event emitter
inherits(UniversalVM, EventEmitter);

_.assign(UniversalVM.prototype, {
    dispatch: function () {
        try { this._dispatch.apply(this, arguments); }
        catch (e) { this.emit(ERROR_EVENT, e); }
    },

    disconnect: function () {
        try { this._disconnect.apply(this, arguments); }
        catch (e) { this.emit(ERROR_EVENT, e); }
    },

    _dispatch: function (name) {
        this.emit(DISPATCHQUEUE_EVENT, name);
        this._pending.push(arguments);
    },

    _disconnect: function () {
        throw new Error(DISCONNECT_ERROR_MESSAGE);
    }
});

_.assign(UniversalVM, {
    spawn: function (options, callback) {
        return new UniversalVM(options, callback);
    }
});

module.exports = UniversalVM;
