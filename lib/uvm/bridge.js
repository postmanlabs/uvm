var vm = require('vm'),
    bridgeClientCode = require('./bridge-client'),

    /**
     * Convert array or arguments object to JSON
     * @param  {Array|Argument} arr
     * @return {String}
     *
     * @note This has been held as reference to avoid being misused if modified in global context;
     */
    jsonArray = (function (_Array, _JSON) {
        // hold reference to important objects for security purposes
        var arrayProtoSlice = _Array.prototype.slice,
            jsonStringify = _JSON.stringify;

        // release memory
        _Array = null;
        _JSON = null;

        return function (arr) {
            return jsonStringify(arrayProtoSlice.call(arr));
        };
    }(Array, JSON));

/**
 * @param  {EventEmitter} emitter
 * @param  {Object} options
 * @param  {String} options.bootcode
 * @param  {vm~Context} options._sandbox
 * @param  {Function} callback
 */
module.exports = function (emitter, options, callback) {
    var code = bridgeClientCode(options.bootcode),
        context = options._sandbox || vm.createContext();

    // @todo debug remove
    context.console = console;

    try {
        // inject the emitter via context. it will be referenced by the bridge and then deleted to prevent
        // additional access
        context.__emit = function (args) {
            emitter.emit.apply(emitter, JSON.parse(jsonArray(args)));
        };

        vm.runInContext(code, context);
    }
    catch (err) {
        return callback(err);
    }
    finally {
        delete context.__emit;
    }

    // since context is created and emitter is bound, we would now attach the send function
    emitter._dispatch = function () {
        try {
            vm.runInContext(`bridge.emit.apply(bridge, ${jsonArray(arguments)})`, context);
        }
        // swallow errors since other platforms will not trigger error if execution fails
        catch (e) {} // eslint-disable-line no-empty
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
