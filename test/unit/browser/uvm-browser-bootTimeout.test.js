/* eslint-disable mocha/no-top-level-hooks */
(typeof window !== 'undefined' ? describe : describe.skip)('custom sandbox in browser', function () {
    const uvm = require('../../../lib'),
        expect = require('chai').expect,
        firmware = require('../../../firmware/sandbox-base');

    let firmwareUrl,
        worker;

    beforeEach(function () {
        firmwareUrl = window.URL.createObjectURL(new Blob([firmware], { type: 'text/javascript' }));
        worker = new Worker(firmwareUrl);
    });

    afterEach(function () {
        worker.terminate();
        window.URL.revokeObjectURL(firmwareUrl);
        worker = firmwareUrl = null;
    });

    it('should error out if not loaded within bootTimeout limit', function (done) {
        uvm.spawn({
            _sandbox: worker,
            bootTimeout: 1,
            bootCode: `
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, function (err) {
            expect(err).to.have.property('message', 'uvm: boot timed out after 1ms.');
            done();
        });
    });
});
