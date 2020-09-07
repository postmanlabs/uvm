(typeof window !== 'undefined' ? describe : describe.skip)('missing API in browser', function () {
    var uvm = require('../../lib'),
        originalWorker = window.Worker;

    before(function () {
        window.Worker = undefined;
    });

    after(function () {
        window.Worker = originalWorker;
    });

    it('should connect a new context', function (done) {
        uvm.spawn({}, function (err) {
            expect(err).to.be.an('error').that.has.property('message',
                'uvm: unable to setup communication bridge, missing required APIs');
            done();
        });
    });
});
