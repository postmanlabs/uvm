/**
 * This is a cross-platform event emitter with bridge interface.
 * It uses Circular JSON as dependency where code is modified slightly to allow loading as a string
 *
 * @note The Circular JSON libraries escape characters have been replaced with variable generated from
 * String.fromCharCode(92);
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
    /*! (C) WebReflection Mit Style License */
    var CircularJSON=function(JSON,RegExp){var specialChar="~",safeSpecialChar="\\\\x"+("0"+specialChar.charCodeAt(0).toString(16)).slice(-2),escapedSafeSpecialChar="\\\\"+safeSpecialChar,specialCharRG=new RegExp(safeSpecialChar,"g"),safeSpecialCharRG=new RegExp(escapedSafeSpecialChar,"g"),safeStartWithSpecialCharRG=new RegExp("(?:^|([^\\\\\\\\]))"+escapedSafeSpecialChar),indexOf=[].indexOf||function(v){for(var i=this.length;i--&&this[i]!==v;);return i},$String=String;function generateReplacer(value,replacer,resolve){var doNotIgnore=false,inspect=!!replacer,path=[],all=[value],seen=[value],mapp=[resolve?specialChar:"[Circular]"],last=value,lvl=1,i,fn;if(inspect){fn=typeof replacer==="object"?function(key,value){return key!==""&&replacer.indexOf(key)<0?void 0:value}:replacer}return function(key,value){if(inspect)value=fn.call(this,key,value);if(doNotIgnore){if(last!==this){i=lvl-indexOf.call(all,this)-1;lvl-=i;all.splice(lvl,all.length);path.splice(lvl-1,path.length);last=this}if(typeof value==="object"&&value){if(indexOf.call(all,value)<0){all.push(last=value)}lvl=all.length;i=indexOf.call(seen,value);if(i<0){i=seen.push(value)-1;if(resolve){path.push((""+key).replace(specialCharRG,safeSpecialChar));mapp[i]=specialChar+path.join(specialChar)}else{mapp[i]=mapp[0]}}else{value=mapp[i]}}else{if(typeof value==="string"&&resolve){value=value.replace(safeSpecialChar,escapedSafeSpecialChar).replace(specialChar,safeSpecialChar)}}}else{doNotIgnore=true}return value}}function retrieveFromPath(current,keys){for(var i=0,length=keys.length;i<length;current=current[keys[i++].replace(safeSpecialCharRG,specialChar)]);return current}function generateReviver(reviver){return function(key,value){var isString=typeof value==="string";if(isString&&value.charAt(0)===specialChar){return new $String(value.slice(1))}if(key==="")value=regenerate(value,value,{});if(isString)value=value.replace(safeStartWithSpecialCharRG,"$1"+specialChar).replace(escapedSafeSpecialChar,safeSpecialChar);return reviver?reviver.call(this,key,value):value}}function regenerateArray(root,current,retrieve){for(var i=0,length=current.length;i<length;i++){current[i]=regenerate(root,current[i],retrieve)}return current}function regenerateObject(root,current,retrieve){for(var key in current){if(current.hasOwnProperty(key)){current[key]=regenerate(root,current[key],retrieve)}}return current}function regenerate(root,current,retrieve){return current instanceof Array?regenerateArray(root,current,retrieve):current instanceof $String?current.length?retrieve.hasOwnProperty(current)?retrieve[current]:retrieve[current]=retrieveFromPath(root,current.split(specialChar)):root:current instanceof Object?regenerateObject(root,current,retrieve):current}var CircularJSON={stringify:function stringify(value,replacer,space,doNotResolve){return CircularJSON.parser.stringify(value,generateReplacer(value,replacer,!doNotResolve),space)},parse:function parse(text,reviver){return CircularJSON.parser.parse(text,generateReviver(reviver))},parser:JSON};return CircularJSON}(JSON,RegExp);


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
            emit(CircularJSON.stringify(arrayProtoSlice.call(arguments)));
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
    __uvm_dispatch = (function (bridge, bridgeEmit) { // ensure global using no var
        return function (args) {
            bridgeEmit.apply(bridge, CircularJSON.parse(args));
        };
    }(bridge, bridge.emit));

}(__uvm_emit));

// boot code starts hereafter
${(typeof bootCode === STRING) ? toString.call(bootCode) : ''};`;
};
