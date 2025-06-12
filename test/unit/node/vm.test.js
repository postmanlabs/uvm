const uvm = require('../../..'),
    expect = require('chai').expect;

describe('vm ', function () {
    it('should use vm.runInThisContext to execute boot code', function (done) {
        const context = uvm.spawn({
            debug: true,
            bootCode: `
                (async function () {
                    const mod = await import('child_process');
                    bridge.dispatch('execute', mod);
                })();
            `
        });

        context.on('error', (err) => {
            expect(err).to.be.ok;
            expect(err).to.have.property('code', 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING');
            done();
        });
        context.on('execute', function (mod) {
            expect(mod).to.be.an('object');
            done(new Error('Dynamic import should not be allowed'));
        });

        context.dispatch('execute');
    });
});
