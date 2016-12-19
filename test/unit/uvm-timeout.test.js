describe('uvm timeout option', function () {
    var uvm = require('../../lib');

    // options.bootTimeout is not implemented in browser sandbox. Reason is that as long as we use iFrame, there is no
    // way to interrupt an infinite loop.
    ((typeof window === 'undefined') ? it : it.skip)('must exit if bootCode has infinite loop', function (done) {
        uvm.spawn({
            bootTimeout: 100,
            bootcode: 'while(1) {}'
        }, function (err, context) {
            expect(err).be.ok();
            expect(err).have.property('message', 'Script execution timed out.');
            context && context.on('error', done);
            done();
        });
    });
});
