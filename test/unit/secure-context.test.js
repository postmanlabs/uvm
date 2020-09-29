const uvm = require('../..'),
    expect = require('chai').expect;

describe('uvm security', function () {
    it('should not be polluted with the global prototype', function (done) {
        const context = uvm.spawn({
            bootCode: `
                bridge.on('execute', function (data) {
                    bridge.dispatch('execute', {
                        result: (function () {
                            return this.constructor.constructor('return Object.keys(this)')();
                        })()
                    });
                });
            `
        });

        context.on('error', done);
        context.on('execute', function (out) {
            expect(out.result).to.be.an('array').that.does.not.include('process');
            done();
        });

        context.dispatch('execute');
    });

    it('should not leak __uvm_* private variables in global scope', function (done) {
        uvm.spawn({
            bootCode: `
                bridge.on('getProps', function () {
                    bridge.dispatch('getProps', Object.getOwnPropertyNames(Function('return this')()));
                });
            `
        }, function (err, context) {
            expect(err).to.be.null;

            context.on('error', done);
            context.on('getProps', function (data) {
                expect(data).to.be.an('array').that.is.not.empty;

                for (let key of data) {
                    expect(key).to.not.have.string('__uvm');
                }

                done();
            });

            context.dispatch('getProps');
        });
    });
});
