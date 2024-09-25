/* istanbul ignore file */
class WebWorker {
    constructor (bootCode) {
        if (!(Blob && Worker && window && window.URL && window.URL.createObjectURL)) {
            throw new Error('Missing required APIs');
        }

        const firmwareObjectURL = window.URL.createObjectURL(new Blob([bootCode], { type: 'text/javascript' }));

        this.worker = new Worker(firmwareObjectURL);

        window.URL.revokeObjectURL(firmwareObjectURL);
        WebWorker.attachNodeStyleListener(this, this.worker);
    }

    postMessage (data) {
        this.worker.postMessage(data);
    }

    terminate () {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        return Promise.resolve();
    }

    static attachNodeStyleListener (self, worker) {
        function extract (name, event) {
            switch (name) {
                case 'message':
                    return event.data;
                case 'error':
                    return event.error || new Error(event.message);
                case 'unhandledrejection':
                    return event.reason;
                default:
                    throw new Error('uvm: Unknown event type');
            }
        }

        if (!worker) {
            worker = self;
        }

        self.on = function (name, listener) {
            worker.addEventListener(name, function (event) {
                listener(extract(name, event));
            });
        };

        self.off = worker.removeEventListener.bind(worker);
    }

    static __self = `(function () {
        function ${WebWorker.attachNodeStyleListener.toString()}
        attachNodeStyleListener(self);
        return self;
    }())`;

    static __exceptionHandler = `
    ((close) => {
        self.close = () => {
            bridge.dispatch('exit');
            close.call(self);
        }

    })(self.close)

    const onError = function (event) {
        if (bridge.listeners('uncaughtException').length) {
            event.preventDefault();
            return bridge.emit('uncaughtException', event.error || event.reason);
        }

        // Instance of PromiseRejectionEvent
        if (event.reason) {
            event.preventDefault();
            throw event.reason;
        }

        setTimeout(self.close, 0);
    };

    // Not using 'self.on' since we need the original event object in 'onError'.
    self.addEventListener('error', onError);
    self.addEventListener('unhandledrejection', onError);
    `;
}

module.exports = WebWorker;
