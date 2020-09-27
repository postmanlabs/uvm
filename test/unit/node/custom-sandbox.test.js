(typeof window === 'undefined' ? describe : describe.skip)('node bridge', function () {
    const vm = require('vm'),
        uvm = require('../../../lib'),
        expect = require('chai').expect;

    describe('with custom sandbox', function () {
        let sandbox;

        beforeEach(function () {
            sandbox = vm.createContext({ foo: 'bar' });
        });

        afterEach(function () {
            sandbox = null;
        });

        it('should load and dispatch messages', function (done) {
            uvm.spawn({
                _sandbox: sandbox,
                bootCode: `
                    bridge.on('loopback', function () {
                        bridge.dispatch('loopback', foo);
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
