(typeof window !== 'undefined' ? describe : describe.skip)('missing API in browser', function () {
    const uvm = require('../../lib'),
        expect = require('chai').expect;

    let originalWorker;

    before(function () {
        originalWorker = window.Worker;
        window.Worker = undefined;
    });

    after(function () {
        window.Worker = originalWorker;
        originalWorker = null;
    });

    it('should connect a new context', function (done) {
        uvm.spawn({}, function (err) {
            expect(err).to.be.an('error').that.has.property('message',
                'uvm: unable to setup communication bridge, missing required APIs');
            done();
        });
    });
});
