var _ = require('lodash'),
    inherits = require('inherits'),
    EventEmitter = require('events'),
    bridge = require('./bridge'),

    UniversalVM;

/**
 * @constructor
 * @extends {EventEmitter}
 * @param {Object} options
 * @param {Function} callback
 */
UniversalVM = function UniversalVM (options, callback) {

    // set defaults for parameters
    !_.isObject(options) && (options = {});
    !_.isFunction(callback) && (callback = _.noop);

    // call the super constructor
    EventEmitter.call(this);

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
        var args;

        // we dispatch all pending messages provided nothing had errors
        while ((args = this._pending.shift())) {
            this.dispatch.apply(this, args);
        }

        callback(err, this);
    }.bind(this));
};

// make UVM inherit from event emitter
inherits(UniversalVM, EventEmitter);

_.assign(UniversalVM.prototype, {
    dispatch: function () {
        this._dispatch.apply(this, arguments);
    },

    disconnect: function () {
        this._disconnect.apply(this, arguments);
    },

    _dispatch: function () {
        this.emit('dispatchQueued');
        this._pending.push(arguments);
    },

    _disconnect: function () {
        throw new Error('uvm: cannot disconnect, communication bridge is broken');
    }
});

_.assign(UniversalVM, {
    spawn: function (options, callback) {
        return new UniversalVM(options, callback);
    }
});

module.exports = UniversalVM;
