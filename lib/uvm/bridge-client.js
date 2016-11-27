var STRING = 'string', // constant
    toString = String.prototype.toString; // hold reference to this for security purpose

/**
 * Generate code to be executed inside a VM for bootstrap
 * @return {String}
 */
module.exports = function (bootcode) {
    return `;
bridge = (function () {
    var _emit = __emit,
        arrayProtoSlice = Array.prototype.slice;

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
            _emit(arrayProtoSlice.call(arguments));
        },

        on: function (name, listener) {
            !this._events[name] && (this._events[name] = []);
            this._events[name].push(listener);
        }
    };
}());
delete __emit;

${(typeof bootcode === STRING) ? toString.call(bootcode) : ''};`;
};
