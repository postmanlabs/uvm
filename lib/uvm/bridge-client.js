/**
 * This is a cross-platform event emitter with bridge interface.
 * It uses Flatted as dependency where code is modified slightly to allow loading as a string
 */
var STRING = 'string', // constant
    toString = String.prototype.toString; // hold reference to this for security purpose

/**
 * Generate code to be executed inside a VM for bootstrap.
 *
 * @param {String|Buffer} bootCode
 * @return {String}
 */
/* eslint-disable max-len */
module.exports = function (bootCode) {
    return `;
(function (emit) {
    /*! (c) 2020 Andrea Giammarchi, (ISC) */
    var Flatted=function(n){"use strict";var t=JSON.parse,r=JSON.stringify,e=Object.keys,u=String,i="string",c="object",f=function(n,t){return t},a=function(n){return n instanceof u?u(n):n},o=function(n,t){return typeof t===i?new u(t):t},s=function(n,t,r){var e=u(t.push(r)-1);return n.set(r,e),e};return n.parse=function(n,r){var i=t(n,o).map(a),s=i[0],l=r||f,p=typeof s===c&&s?function n(t,r,i,f){return e(i).reduce((function(e,i){var a=e[i];if(a instanceof u){var o=t[a];typeof o!==c||r.has(o)?e[i]=f.call(e,i,o):(r.add(o),e[i]=f.call(e,i,n(t,r,o,f)))}else e[i]=f.call(e,i,a);return e}),i)}(i,new Set,s,l):s;return l.call({"":p},"",p)},n.stringify=function(n,t,e){for(var u=t&&typeof t===c?function(n,r){return""===n||-1<t.indexOf(n)?r:void 0}:t||f,a=new Map,o=[],l=[],p=+s(a,o,u.call({"":n},"",n)),v=!p;p<o.length;)v=!0,l[p]=r(o[p++],y,e);return"["+l.join(",")+"]";function y(n,t){if(v)return v=!v,t;var r=u.call(this,n,t);switch(typeof r){case c:if(null===r)return r;case i:return a.get(r)||s(a,o,r)}return r}},n}({});

    /*! (C) Postdot Technologies, Inc (Apache-2.0) */
    var arrayProtoSlice = Array.prototype.slice;

    bridge = { // ensure global using no var
        _events: {},
        emit: function (name) {
            var self = this,
                args = arrayProtoSlice.call(arguments, 1);
            this._events[name] && this._events[name].forEach(function (listener) {
                listener.apply(self, args);
            });
        },

        dispatch: function () {
            emit(Flatted.stringify(arrayProtoSlice.call(arguments)));
        },

        on: function (name, listener) {
            if (typeof listener !== 'function') { return; }
            !this._events[name] && (this._events[name] = []);
            this._events[name].push(listener);
        },

        off: function (name, listener) {
            var e = this._events[name],
                i = e && e.length || 0;

            if (!e) { return; }
            if (arguments.length === 1) {
                return delete this._events[name];
            }

            if (typeof listener === 'function' && (i >= 1)) {
                while (i >= 0) {
                    (e[i] === listener) && e.splice(i, 1);
                    i -= 1;
                }
            }
            if (!e.length) { delete this._events[name]; }
        }
    };

    // create the dispatch function inside a closure to ensure that actual function references are never modified
    __uvm_dispatch = (function (bridge, bridgeEmit) { // ensure global by not using var statement
        return function (args) {
            bridgeEmit.apply(bridge, Flatted.parse(args));
        };
    }(bridge, bridge.emit));

}(__uvm_emit));

// boot code starts hereafter
${(typeof bootCode === STRING) ? toString.call(bootCode) : ''};`;
};
