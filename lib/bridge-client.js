/**
 * This is a cross-platform event emitter with bridge interface.
 * It uses Flatted as dependency where code is modified slightly to allow loading as a string
 */

/**
 * Hold reference to this for security purpose
 *
 * @private
 */
const toString = String.prototype.toString;

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
    var Flatted=function(n){"use strict";function t(n){return t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(n){return typeof n}:function(n){return n&&"function"==typeof Symbol&&n.constructor===Symbol&&n!==Symbol.prototype?"symbol":typeof n},t(n)}var r=JSON.parse,e=JSON.stringify,o=Object.keys,u=String,f="string",i={},c="object",a=function(n,t){return t},l=function(n){return n instanceof u?u(n):n},s=function(n,r){return t(r)===f?new u(r):r},y=function n(r,e,f,a){for(var l=[],s=o(f),y=s.length,p=0;p<y;p++){var v=s[p],S=f[v];if(S instanceof u){var b=r[S];t(b)!==c||e.has(b)?f[v]=a.call(f,v,b):(e.add(b),f[v]=i,l.push({k:v,a:[r,e,b,a]}))}else f[v]!==i&&(f[v]=a.call(f,v,S))}for(var m=l.length,g=0;g<m;g++){var h=l[g],O=h.k,d=h.a;f[O]=a.call(f,O,n.apply(null,d))}return f},p=function(n,t,r){var e=u(t.push(r)-1);return n.set(r,e),e},v=function(n,e){var o=r(n,s).map(l),u=o[0],f=e||a,i=t(u)===c&&u?y(o,new Set,u,f):u;return f.call({"":i},"",i)},S=function(n,r,o){for(var u=r&&t(r)===c?function(n,t){return""===n||-1<r.indexOf(n)?t:void 0}:r||a,i=new Map,l=[],s=[],y=+p(i,l,u.call({"":n},"",n)),v=!y;y<l.length;)v=!0,s[y]=e(l[y++],S,o);return"["+s.join(",")+"]";function S(n,r){if(v)return v=!v,r;var e=u.call(this,n,r);switch(t(e)){case c:if(null===e)return e;case f:return i.get(e)||p(i,l,e)}return e}};return n.fromJSON=function(n){return v(e(n))},n.parse=v,n.stringify=S,n.toJSON=function(n){return r(S(n))},n}({});

    /*! (C) Postdot Technologies, Inc (Apache-2.0) */
    var arrayProtoSlice = Array.prototype.slice;

    bridge = { // ensure global using no var
        _events: {},
        emit: function (name) {
            var self = this,
                args = arrayProtoSlice.call(arguments, 1);
            this._events[name] && [...this._events[name]].forEach(function (listener) {
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

        once: function (name, listener) {
            const self = this;
            self.on(name, function fn () {
                self.off(name, fn);
                listener.apply(self, arguments);
            });
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
${(typeof bootCode === 'string') ? toString.call(bootCode) : ''};`;
};
