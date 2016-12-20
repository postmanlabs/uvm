var vm = require('vm'),
    bridgeClientCode = require('./bridge-client'),
    CircularJSON = require('circular-json'),
    STRING = 'string',
    ERROR = 'error',

    ESCAPED_SINGLEQUOTE = '\'',
    ESCAPED_BKSLASH = '\\\\',
    MATCH_SINGLEQUOTES = /'/g,
    MATCH_BKSLASH = /\\/g,

    /**
     * Replace all instances of single quote with its escaped counterpart in string form \' and also escape back
     * slash
     * @param {String} str
     * @returns {String}
     */
    escapeCharacters = function (str) {
        return str.replace(MATCH_SINGLEQUOTES, ESCAPED_SINGLEQUOTE).replace(MATCH_BKSLASH, ESCAPED_BKSLASH);
    },

    /**
     * Convert array or arguments object to JSON
     * @param  {Array|Argument} arr
     * @return {String}
     *
     * @note This has been held as reference to avoid being misused if modified in global context;
     */
    jsonArray = (function (arrayProtoSlice, jsonStringify) {
        return function (arr) {
            return jsonStringify(arrayProtoSlice.call(arr));
        };
    }(Array.prototype.slice, CircularJSON.stringify)),

    /**
     * @param  {String} str
     * @return {Array}
     */
    unJsonArray = (function (jsonParse) {
        return function (str) {
            return jsonParse(str);
        };
    }(CircularJSON.parse));

/**
 * This function equips an event emitter with communication capability with a VM.
 *
 * @param  {EventEmitter} emitter
 * @param  {Object} options
 * @param  {String} options.bootCode
 * @param  {vm~Context=} [options._sandbox]
 * @param  {Function} callback
 */
module.exports = function (emitter, options, callback) {
    var code = bridgeClientCode(options.bootCode),
        context = options._sandbox || vm.createContext(),
        bridgeDispatch;

    // inject console on debug mode
    options.debug && (context.console = console);

    try {
        // inject the emitter via context. it will be referenced by the bridge and then deleted to prevent
        // additional access
        context.__uvm_emit = function (args) {
            if (typeof args !== STRING) { return; }

            try { args = unJsonArray(args); }
            catch (err) { emitter.emit(ERROR, err); }

            emitter.emit.apply(emitter, args);
        };

        vm.runInContext(code, context, {
            timeout: options.bootTimeout
        });

        // we keep a reference to the dispatcher so that we can preemptively re inject it in case it is deleted
        // by user scripts
        bridgeDispatch = context.__uvm_dispatch;
    }
    catch (err) {
        return callback(err);
    }
    finally { // set all raw interface methods to null (except the dispatcher since we need it later)
        context.__uvm_emit = null;
        vm.runInContext('__uvm_emit = null;', context);
    }

    // since context is created and emitter is bound, we would now attach the send function
    emitter._dispatch = function () {
        try {
            // precautionary restore of the dispatcher in case it's gone!
            !context.__uvm_dispatch && (context.__uvm_dispatch = bridgeDispatch);
            vm.runInContext(`__uvm_dispatch('${escapeCharacters(jsonArray(arguments))}');`, context, {
                timeout: options.dispatchTimeout
            });
        }
        // swallow errors since other platforms will not trigger error if execution fails
        catch (e) { this.emit(ERROR, e); }
    };

    emitter._disconnect = function () {
        if (!context) { return; }

        // clear only if the context was created inside this function
        !options._sandbox && Object.keys(context).forEach(function (prop) {
            delete context[prop];
        });
        context = null;
    };

    callback(null, emitter);
};
