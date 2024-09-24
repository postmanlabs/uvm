const { Worker } = require('worker_threads');

class NodeWorker extends Worker {
    constructor (bootCode, options) {
        super(bootCode, {
            eval: true,
            stdout: !options?.debug,
            stderr: !options?.debug,
            execArgv: [
                // TODO: To be removed when support for Node.js v18 is dropped
                '--experimental-global-webcrypto'
            ]
        });
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
