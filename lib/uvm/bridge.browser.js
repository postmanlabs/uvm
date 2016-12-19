var _ = require('lodash'),
    CircularJSON = require('circular-json'),
    MESSAGE = 'message',
    LOAD = 'load',
    ERROR = 'error',
    TARGET_ALL = '*',
    SANDBOX_ELEMENT_TAG = 'iframe',

    // code for bridge
    bridgeClientCode = require('./bridge-client'),

    /**
     * Default DOM attributes of sandbox
     * @type {Object}
     */
    sandboxAttributes = {
        'class': 'postman-uvm-context',
        'style': 'display:none;',
        'sandbox': 'allow-scripts'
    },

    /**
     * Returns the HTML to be executed inside iFrame
     * @param  {String} code
     * @return {String}
     */
    sandboxCode = function (code) {
        return `<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html;charset=UTF-8">
            <meta charset="UTF-8">
            <script type="text/javascript">
            __uvm_emit = function (args) {window.parent.postMessage({__emit_uvm: args}, "*");};</script>
            <script type="text/javascript">${code}</script>
            <script type="text/javascript">(function (emit) {
                window.addEventListener("message", function (e) {
                    (e && e.data && (typeof e.data.__emit_uvm === 'string')) && emit(e.data.__emit_uvm);
                });
            }(__uvm_dispatch));
            __uvm_dispatch = null; __uvm_emit = null;</script>
            </head></html>`;
    };

module.exports = function (bridge, options, callback) {
    !options && (options = {});

    var code = bridgeClientCode(options.bootcode),
        iframe = options._sandbox || document.createElement(SANDBOX_ELEMENT_TAG),

        // function to forward messages emitted
        forwardEmits = function (e) {
            if (!(e && e.data && _.isString(e.data.__emit_uvm))) { return; }

            var args;
            try { args = CircularJSON.parse(e.data.__emit_uvm); }
            catch (err) { return bridge.emit(ERROR, err); }
            bridge.emit.apply(bridge, args);
        },

        processCallback = function () {
            iframe.removeEventListener(LOAD, processCallback);

            bridge._dispatch = function () {
                iframe && iframe.contentWindow.postMessage({
                    __emit_uvm: CircularJSON.stringify(Array.prototype.slice.call(arguments))
                }, TARGET_ALL);
            };

            callback(null, bridge);
        };

    // add event listener for receiving events from iframe (is removed on disconnect)
    window.addEventListener(MESSAGE, forwardEmits);
    iframe.addEventListener(LOAD, processCallback); // removed right when executed

    // prepare an iframe as context
    _.forEach(sandboxAttributes, function (val, prop) {
        iframe.setAttribute(prop, val);
    });

    // add HTML and bootstrap code to the iframe
    iframe.setAttribute('src', 'data:text/html;base64, ' + btoa(unescape(encodeURIComponent(sandboxCode(code)))));

    // equip bridge to disconnect (i.e. delete the iframe)
    bridge._disconnect = function () {
        if (!iframe) { return; }

        window.removeEventListener(MESSAGE, forwardEmits);

        // do not delete sandbox element if not created for the bridge
        !options._sandbox && iframe.parentNode && iframe.parentNode.removeChild(iframe);
        iframe = null;
    };

    // now append the iframe to start processing stuff
    document.body.appendChild(iframe);
};
