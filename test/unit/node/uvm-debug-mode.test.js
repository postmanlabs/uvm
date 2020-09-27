/* eslint-disable mocha/no-top-level-hooks */
const expect = require('chai').expect,
    uvm = require('../../../lib');

((typeof window === 'undefined') ? describe : describe.skip)('uvm debug', function () {
    let originalConsole = console,
        consoleCalled = false;

    before(function () {
        // eslint-disable-next-line no-global-assign, no-implicit-globals
        console = {
            log () {
                consoleCalled = true;
            }
        };
    });

    after(function () {
        // eslint-disable-next-line no-global-assign, no-implicit-globals
        console = originalConsole;
    });

    it('should inject console on debug mode', function (done) {
        uvm.spawn({
            debug: true,
            bootCode: `
                bridge.on('loopback', function (data) {
                    console.log();
                    bridge.dispatch('loopback', typeof console.log);
                });
            `
        }, (err, context) => {
            expect(err).to.be.null;

            context.on('loopback', function (data) {
                expect(consoleCalled).to.be.true;
                expect(data).to.equal('function');
                done();
            });

            context.dispatch('loopback');
        });
    });
});
