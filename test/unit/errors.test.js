const uvm = require('../../lib'),
    expect = require('chai').expect,
    isNode = (typeof window === 'undefined');

describe('uvm errors', function () {
    it('should raise an error if sandbox disconnect is somehow broken', function (done) {
        let context = uvm.spawn();

        // delete context._disconnect to further sabotage the bridge
        delete context._disconnect;

        context.on('error', function (err) {
            expect(err).to.be.ok;
            expect(err).to.have.property('message', 'uvm: cannot disconnect, communication bridge is broken');
            done();
        });

        context.disconnect();
    });

    it('should dispatch cyclic object', function (done) {
        let context = uvm.spawn({
                bootCode: `
                    bridge.on('transfer', function (data) {
                        bridge.dispatch('transfer', data);
                    });
                `
            }),

            cyclic,
            subcycle;

        context.on('error', done);
        context.on('transfer', function (data) {
            expect(data).to.be.an('object').that.has.property('child').that.has.property('parent', data);
            done();
        });

        // create a cyclic object
        cyclic = {};
        subcycle = { parent: cyclic };
        cyclic.child = subcycle;

        context.dispatch('transfer', cyclic);
    });

    it('should not allow bridge raw interfaces to be accessed', function (done) {
        uvm.spawn({
            bootCode: `
                bridge.on('probe', function () {
                    bridge.dispatch('result', {
                        typeofEmitter: typeof __uvm_emit,
                        typeofDispatcher: typeof __uvm_dispatch
                    });
                });
            `
        }, function (err, context) {
            if (err) { return done(err); }
            context.on('error', done);
            context.on('result', function (test) {
                expect(test).to.be.an('object').that.not.include({
                    typeofEmitter: 'function',
                    typeofDispatcher: 'function'
                });
                done();
            });
            context.dispatch('probe');
        });
    });

    it('should allow escape sequences in arguments to be dispatched', function (done) {
        uvm.spawn({
            bootCode: `
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, function (err, context) {
            expect(err).to.be.null;

            context.on('error', done);
            context.on('loopback', function (data) {
                // eslint-disable-next-line no-useless-escape
                expect(data).to.equal('this has \n "escape" \'characters\"');
                done();
            });

            // eslint-disable-next-line no-useless-escape
            context.dispatch('loopback', 'this has \n "escape" \'characters\"');
        });
    });

    it('should trigger error if dispatched post disconnection', function (done) {
        uvm.spawn({
            bootCode: `
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, function (err, context) {
            expect(err).to.be.null;

            context.on('error', function (err) {
                expect(err).to.be.an('error').that.has.property('message',
                    'uvm: unable to dispatch "loopback" post disconnection.');
                done();
            });

            context.on('loopback', function () {
                throw new Error('loopback callback was unexpected post disconnection');
            });

            context.disconnect(() => {
                context.dispatch('loopback', 'this never returns');
            });
        });
    });

    describe('when uncaughtException is handled', function () {
        it('should only trigger uncaughtException event on synchronous error and not terminate', function (done) {
            uvm.spawn({
                bootCode: `
                    bridge.on('uncaughtException', function (err) {
                        bridge.dispatch('uncaughtException', err.message);
                    });
                    bridge.on('ping', function () {
                        bridge.dispatch('pong');
                    });
                    throw new Error('error in bootCode');
                `
            }, function (err, context) {
                expect(err).to.be.null;
                context.on('error', done);
                context.on('uncaughtException', function (error) {
                    expect(error).to.include('error in bootCode');
                    context.dispatch('ping');
                });
                context.on('exit', function () {
                    done(new Error('exit should not be triggered'));
                });

                context.on('pong', done);
            });
        });

        it('should only trigger uncaughtException event on asynchronous error and not terminate', function (done) {
            uvm.spawn({
                bootCode: `
                    bridge.on('uncaughtException', function (err) {
                        bridge.dispatch('uncaughtException', err.message);
                    });
                    bridge.on('ping', function () {
                        bridge.dispatch('pong');
                    });
                    async function main () {
                        await Promise.reject(new Error('error in bootCode'));
                    }
                    main();
                `
            }, function (err, context) {
                expect(err).to.be.null;
                context.on('uncaughtException', function (error) {
                    expect(error).to.include('error in bootCode');
                    context.dispatch('ping');
                });
                context.on('exit', function () {
                    done(new Error('exit should not be triggered'));
                });
                context.on('pong', done);
            });
        });
    });

    // FIXME: On web the test runner exits before the `exit` event with an error, causing the test to fail.
    (isNode ? describe : describe.skip)('when uncaughtException is not handled', function () {
        it('should only trigger error event on synchronous error and terminate', function (done) {
            uvm.spawn({
                debug: true,
                bootCode: `
                    setTimeout(function () {
                        bridge.dispatch('ping');
                    }, 1000);

                    throw new Error ('error in bootCode');
                `
            }, function (err, context) {
                expect(err).to.be.null;
                context.on('uncaughtException', function () {
                    done(new Error('uncaughtException should not be triggered'));
                });
                context.on('ping', () => {
                    done(new Error('ping should not be triggered'));
                });
                context.on('error', function (error) {
                    if (isNode) {
                        expect(error).to.have.property('message', 'error in bootCode');
                    }
                    else {
                        expect(error).to.have.property('message', 'Uncaught Error: error in bootCode');
                    }
                });
                context.on('exit', done);
            });
        });

        it('should only trigger error event on asynchronous error and terminate', function (done) {
            uvm.spawn({
                bootCode: `
                    setTimeout(function () {
                        bridge.dispatch('ping');
                    }, 1000);

                    async function main () {
                        await Promise.reject(new Error('error in bootCode'));
                    }

                    main();
                `
            }, function (err, context) {
                expect(err).to.be.null;
                context.on('uncaughtException', function () {
                    done(new Error('uncaughtException should not be triggered'));
                });
                context.on('ping', () => {
                    done(new Error('ping should not be triggered'));
                });
                context.on('error', function (error) {
                    if (isNode) {
                        expect(error).to.have.property('message', 'error in bootCode');
                    }
                    else {
                        expect(error).to.have.property('message', 'Uncaught Error: error in bootCode');
                    }
                });
                context.on('exit', done);
            });
        });
    });
});
