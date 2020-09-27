/* eslint-disable mocha/no-top-level-hooks */
(typeof window !== 'undefined' ? describe : describe.skip)('spawn error in browser', function () {
    const uvm = require('../../lib'),
        expect = require('chai').expect;

    let originalWorker;

    before(function () {
        originalWorker = window.Worker;
        window.Worker = function () {
            throw new Error('CSP error!');
        };
    });

    after(function () {
        window.Worker = originalWorker;
        originalWorker = null;
    });

    it('should error out if worker can\'t be loaded', function (done) {
        uvm.spawn({}, function (err) {
            expect(err).to.be.an('error').that.has.property('message',
                'uvm: unable to spawn worker.\nCSP error!');
            done();
        });
    });
});
