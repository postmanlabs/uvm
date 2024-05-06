/* istanbul ignore file */
class BridgeWorker {
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

    terminate () {
        if (!this.worker) { return; }

        this.worker.terminate();
        this.worker = null;
    }

    static __self = 'self';

    static __exceptionHandler = `
    const onError = function (event) {
        if (bridge.listeners('uncaughtException').length) {
            event.preventDefault();
            return bridge.emit('uncaughtException', event.error || event.reason);
        }

        if (event.reason) {
            event.preventDefault();
            throw event.reason;
        }
    };

    self.addEventListener('error', onError);
    self.addEventListener('unhandledrejection', onError);
    `;
}

module.exports = BridgeWorker;
