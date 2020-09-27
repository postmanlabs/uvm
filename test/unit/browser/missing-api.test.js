(typeof window !== 'undefined' ? describe : describe.skip)('browser bridge', function () {
    const uvm = require('../../../lib'),
        expect = require('chai').expect;

    describe('with missing API', function () {
        let originalWorker;

        before(function () {
            originalWorker = window.Worker;
            window.Worker = undefined;
        });

        after(function () {
            window.Worker = originalWorker;
            originalWorker = null;
        });

        it('should error out if required browser APIs are missing', function (done) {
            uvm.spawn({}, function (err) {
                expect(err).to.be.an('error').that.has.property('message',
                    'uvm: unable to setup communication bridge, missing required APIs');
                done();
            });
        });
    });
});
