(typeof window !== 'undefined' ? describe : describe.skip)('browser bridge', function () {
    const uvm = require('../../../lib'),
        expect = require('chai').expect,
        firmware = require('../../../firmware/sandbox-base');

    describe('with custom sandbox', function () {
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

        it('should load and dispatch messages', function (done) {
            uvm.spawn({
                _sandbox: worker,
                bootCode: `
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
});
