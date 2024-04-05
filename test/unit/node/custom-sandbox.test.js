(typeof window === 'undefined' ? describe : describe.skip)('node bridge', function () {
    const { Worker } = require('worker_threads'),
        uvm = require('../../../lib'),
        expect = require('chai').expect,
        firmware = require('../../../firmware/sandbox-base');

    describe('with custom sandbox', function () {
        let worker;

        beforeEach(function () {
            worker = new Worker(firmware, { eval: true, workerData: { foo: 'bar' } });
        });

        afterEach(function () {
            worker = null;
        });

        it('should load and dispatch messages', function (done) {
            uvm.spawn({
                _sandbox: worker,
                bootCode: `
                    const { workerData } = require('worker_threads');
                    bridge.on('loopback', function () {
                        bridge.dispatch('loopback', workerData.foo);
                    });
                `
            }, function (err, context) {
                if (err) { return done(err); }

                context.on('loopback', function (data) {
                    expect(data).to.equal('bar');
                    context.disconnect();
                    done();
                });
                context.dispatch('loopback');
            });
        });
    });
});
