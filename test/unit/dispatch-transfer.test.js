/* global SharedArrayBuffer */
const expect = require('chai').expect,
    uvm = require('../../lib'),

    // echoes the event arguments back, with the bytes of every buffer received
    bootCode = `
        bridge.on('echo', function (...args) {
            const buffers = args.pop();

            bridge.dispatch('echo', args, buffers.map(function (buffer) {
                return [buffer instanceof Uint8Array, Array.from(buffer)];
            }));
        });

        bridge.on('count', function () {
            bridge.dispatch('count', arguments.length);
        });
    `;

describe('uvm dispatchTransfer', function () {
    let context;

    beforeEach(function (done) {
        uvm.spawn({ bootCode }, (err, ctx) => {
            context = ctx;
            done(err);
        });
    });

    afterEach(function (done) {
        context ? context.disconnect(done) : done();
    });

    it('should move a buffer to the other end', function (done) {
        const buffer = Buffer.from(new Uint8Array([1, 2, 3]).buffer);

        context.on('echo', (args, received) => {
            expect(args).to.eql(['a', { b: 1 }]);
            expect(received).to.eql([[true, [1, 2, 3]]]);
            done();
        });

        context.dispatchTransfer([buffer], 'echo', 'a', { b: 1 });
        expect(buffer.buffer.byteLength, 'transferred buffer is detached').to.equal(0);
    });

    it('should copy a buffer that shares its memory instead of detaching it', function (done) {
        const pool = new Uint8Array([9, 1, 2, 3, 9]),
            part = Buffer.from(pool.buffer, 1, 3);

        context.on('echo', (args, received) => {
            expect(received).to.eql([[true, [1, 2, 3]]]);
            expect(Array.from(pool)).to.eql([9, 1, 2, 3, 9]);
            done();
        });

        context.dispatchTransfer([part], 'echo');
    });

    it('should accept an ArrayBuffer and the same buffer more than once', function (done) {
        const buffer = new Uint8Array([4, 5]);

        context.on('echo', (args, received) => {
            expect(received).to.eql([[true, [4, 5]], [true, [4, 5]], [true, [6]]]);
            done();
        });

        context.dispatchTransfer([buffer, buffer, new Uint8Array([6]).buffer], 'echo');
    });

    it('should share a SharedArrayBuffer instead of transferring it', function (done) {
        // browsers expose it only to cross-origin isolated pages
        if (typeof SharedArrayBuffer === 'undefined') {
            this.skip();
        }

        const shared = new Uint8Array(new SharedArrayBuffer(2));

        shared.set([7, 8]);

        context.on('echo', (args, received) => {
            expect(received).to.eql([[true, [7, 8]]]);
            expect(Array.from(shared)).to.eql([7, 8]);
            done();
        });

        context.dispatchTransfer([shared], 'echo');
    });

    it('should keep the buffers of a dispatch queued before connect', function (done) {
        const vm = new uvm();

        vm.on('echo', (args, received) => {
            expect(args).to.eql(['queued']);
            expect(received).to.eql([[true, [1]]]);
            vm.disconnect(done);
        });

        vm.dispatchTransfer([new Uint8Array([1])], 'echo', 'queued');
        vm.connect({ bootCode }, (err) => { err && done(err); });
    });

    it('should not add an argument to a plain dispatch', function (done) {
        context.on('count', (count) => {
            expect(count).to.equal(2);
            done();
        });

        context.dispatch('count', 'a', 'b');
    });

    it('should throw when buffers is not an Array', function () {
        expect(() => { context.dispatchTransfer(Buffer.from([1, 2]), 'echo'); })
            .to.throw(TypeError, 'uvm: dispatchTransfer expects an Array of buffers');
    });

    it('should throw for an entry that is not binary data', function () {
        expect(() => { context.dispatchTransfer(['hello'], 'echo'); })
            .to.throw(TypeError, 'uvm: dispatchTransfer expects ArrayBuffers or ArrayBuffer views');
    });

    it('should throw when a buffer cannot be transferred', function () {
        const buffer = new Uint8Array([1]);

        context.dispatchTransfer([buffer], 'echo');
        expect(() => { context.dispatchTransfer([buffer], 'echo'); }).to.throw();
    });

    it('should replay every queued message when one of them fails', function (done) {
        const vm = new uvm(),
            errors = [];

        vm.on('error', (err) => { errors.push(err.message); });
        vm.on('echo', (args) => {
            expect(args).to.eql(['after']);
            expect(errors).to.have.lengthOf(1);
            vm.disconnect(done);
        });

        vm.dispatch('echo', 10n); // BigInt cannot be serialized
        vm.dispatchTransfer([new Uint8Array([1])], 'echo', 'after');
        vm.connect({ bootCode }, (err) => { err && done(err); });
    });

    it('should throw for a transfer and emit an error for a dispatch after disconnect', function (done) {
        const vm = context,
            errors = [];

        context = null;
        vm.disconnect(() => {
            vm.on('error', (err) => { errors.push(err.message); });

            expect(() => { vm.dispatchTransfer([new Uint8Array([1])], 'echo'); })
                .to.throw('uvm: unable to dispatch "echo" post disconnection.');
            expect(errors, 'a transfer does not emit').to.eql([]);

            vm.dispatch('echo');
            expect(errors).to.eql(['uvm: unable to dispatch "echo" post disconnection.']);
            done();
        });
    });
});
