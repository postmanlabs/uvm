/* istanbul ignore file */
class WebWorker {
    constructor (bootCode) {
        if (!(Blob && Worker && window && window.URL && window.URL.createObjectURL)) {
            throw new Error('Missing required APIs');
        }

        const firmwareObjectURL = window.URL.createObjectURL(new Blob([bootCode], { type: 'text/javascript' }));

        this.worker = new Worker(firmwareObjectURL);

        window.URL.revokeObjectURL(firmwareObjectURL);
    }

    addEventListener (name, listener) {
        this.worker.addEventListener(name, listener);
    }

    removeEventListener (name, listener) {
        this.worker.removeEventListener(name, listener);
    }

    postMessage (data) {
        this.worker.postMessage(data);
    }

    terminate (callback) {
        if (!this.worker) { return; }

        this.worker.terminate();
        this.worker = null;
        callback && callback();
    }

    static __self = 'self';

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

        if (event.reason) {
            event.preventDefault();
            throw event.reason;
        }

        setTimeout(self.close, 0);
    };

    self.addEventListener('error', onError);
    self.addEventListener('unhandledrejection', onError);
    `;
}

module.exports = WebWorker;
