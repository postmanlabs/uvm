const { Worker } = require('worker_threads');

class BridgeWorker {
    constructor (bootCode, options = {}) {
        this.worker = new Worker(bootCode, {
            eval: true,
            stdout: !options.debug,
            stderr: !options.debug
        });
    }

    addEventListener (name, listener) {
        this.worker.on(name, listener);
    }

    removeEventListener (name, listener) {
        this.worker.off(name, listener);
    }

    postMessage (data) {
        this.worker.postMessage(data);
    }

    terminate () {
        if (!this.worker) { return; }

        this.worker.terminate();
        this.worker = null;
    }

    static __self = 'require("worker_threads").parentPort';

    static __exceptionHandler = `
    process.on('uncaughtException', (error) => {
        if (bridge.listeners('uncaughtException').length) {
            return bridge.emit('uncaughtException', error);
        }

        throw error;
    });
    `;
}

module.exports = BridgeWorker;
