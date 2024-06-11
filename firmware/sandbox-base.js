module.exports = `
(function (parentPort) {
    var init = function (m) {
        // eslint-disable-next-line no-eval
        m && m.__init_uvm && (typeof m.__init_uvm === 'string') && eval(m.__init_uvm);
    };
    parentPort.once('message', init);
}(require('worker_threads').parentPort));
`;
