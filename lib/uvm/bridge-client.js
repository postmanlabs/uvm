var STRING = 'string', // constant
    toString = String.prototype.toString; // hold reference to this for security purpose

/**
 * Generate code to be executed inside a VM for bootstrap
 * @return {String}
 */
module.exports = function (bootcode) {
    return `;
bridge = (function (emit, jsonStringify, arrayProtoSlice) {
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
            emit(jsonStringify(arrayProtoSlice.call(arguments)));
        },

        on: function (name, listener) {
            !this._events[name] && (this._events[name] = []);
            this._events[name].push(listener);
        }
    };
}(__uvm_emit, JSON.stringify, Array.prototype.slice));

__uvm_dispatch = (function (bridge, bridgeEmit, jsonParse) {
    return function (args) {
        bridgeEmit.apply(bridge, jsonParse(args));
    };
}(bridge, bridge.emit, JSON.parse));

${(typeof bootcode === STRING) ? toString.call(bootcode) : ''};`;
};
