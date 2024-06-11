const uvm = require('../../lib'),
    expect = require('chai').expect;

describe('with bootTimeout option', function () {
    it('should error out if not loaded within bootTimeout limit', function (done) {
        uvm.spawn({
            bootTimeout: 100,
            bootCode: 'while(1) {}'
        }, function (err, context) {
            expect(err).to.be.an('error').that.has.property('message');

            expect(err.message).to.equal('uvm: boot timed out after 100ms.');
            context && context.on('error', done);
            done();
        });
    });
});
