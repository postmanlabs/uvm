((typeof window === 'undefined') ? describe : describe.skip)('node bridge', function () {
    const uvm = require('../../../lib'),
        expect = require('chai').expect;

    describe('with bootTimeout option', function () {
        it('should exit if bootCode has infinite loop', function (done) {
            uvm.spawn({
                bootTimeout: 100,
                bootCode: 'while(1) {}'
            }, function (err, context) {
                expect(err).to.be.an('error').that.has.property('message');

                // @note nodeVersionDiscrepancy: node version 12 onwards sends a different message
                expect(err.message).to.equal('uvm: boot timed out after 100ms.');
                context && context.on('error', done);
                done();
            });
        });
    });
});
