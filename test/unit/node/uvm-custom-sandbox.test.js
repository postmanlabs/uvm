/* eslint-disable mocha/no-top-level-hooks */
(typeof window === 'undefined' ? describe : describe.skip)('custom sandbox in node', function () {
    const vm = require('vm'),
        uvm = require('../../../lib'),
        expect = require('chai').expect;

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
