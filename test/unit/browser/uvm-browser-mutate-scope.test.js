/* eslint-disable mocha/no-top-level-hooks */
(typeof window !== 'undefined' ? describe : describe.skip)('custom sandbox in browser', function () {
    const uvm = require('../../../lib'),
        firmware = require('../../../firmware/sandbox-base'),
        expect = require('chai').expect;

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

    it('should cache the required methods and not depend on the global scope', function (done) {
        uvm.spawn({
            _sandbox: worker,
            bootCode: `
                // mutate the global scope
                self.postMessage = function noop () {};
                self.addEventListener = function noop () {};

                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, function (err, context) {
            if (err) { return done(err); }

            context.on('loopback', function (data) {
                expect(data).to.equal('this should return');
                done();
            });
            context.dispatch('loopback', 'this should return');
        });
    });
});
