var STRING = 'string', // constant
    toString = String.prototype.toString; // hold reference to this for security purpose

/**
 * Generate code to be executed inside a VM for bootstrap
 * @return {String}
 */
module.exports = function (bootcode) {
    return `;
bridge = (function (emit) {
    var arrayProtoSlice = Array.prototype.slice;

    return {
        _events: {},
        emit: function (name) {
            var self = this,
                args = arrayProtoSlice.call(arguments, 1);
            this._events[name] && this._events[name].forEach(function (listener) {
                listener.apply(self, args);
            });
        },

        dispatch: function () {
            emit(arrayProtoSlice.call(arguments));
        },

        on: function (name, listener) {
            !this._events[name] && (this._events[name] = []);
            this._events[name].push(listener);
        }
    };
}(__uvm_emit));

__uvm_dispatch = (function (bridge) {
    return function (args) {
        bridge.emit.apply(bridge, JSON.parse(args));
    };
}(bridge));

${(typeof bootcode === STRING) ? toString.call(bootcode) : ''};`;
};
