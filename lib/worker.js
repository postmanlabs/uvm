const { Worker } = require('worker_threads');

class NodeWorker {
    constructor (bootCode, options) {
        this.worker = new Worker(bootCode, {
            eval: true,
            stdout: !options?.debug,
            stderr: !options?.debug,
            execArgv: [
                // TODO: To be removed when support for Node.js v18 is dropped
                '--experimental-global-webcrypto'
            ]
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

    terminate (callback) {
        /* istanbul ignore next-line */
        if (!this.worker) { return; }

        this.worker.terminate().then(() => {
            callback && callback();
        });
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

module.exports = NodeWorker;
