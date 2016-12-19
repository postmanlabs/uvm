var vm = require('vm');

describe('bridge-client', function () {
    var bridgeClient = require('../../lib/uvm/bridge-client');

    it('must be a function', function () {
        expect(bridgeClient).withArgs().not.throwException();
    });

    it('must return a client code as result', function () {
        expect(bridgeClient()).be.a('string');
    });

    it('must return a client with bootstrap in it', function () {
        var bootCode = 'console.log("hi mocha");';
        expect(bridgeClient(bootCode)).be.a('string').and.contain(bootCode);
    });

    it('must be a valid JS code (syntax-wise)', function () {
        expect(Function).withArgs(bridgeClient()).not.throwException();
    });

    describe('emitter', function () {
        it('must expose global', function () {
            var context = vm.createContext({
                expect: expect,
                __uvm_emit: function () {
                    throw new Error('Nothing should be emitted');
                }
            });
            vm.runInContext(bridgeClient(), context);

            vm.runInContext(`
                expect(typeof bridge).be('object');
            `, context);
        });

        it('must forward emits to __uvm_emit function', function (done) {
            var context = vm.createContext({
                __uvm_emit: function (message) {
                    expect(arguments.length).be(1);
                    expect(message).be.an('string');
                    expect(message).be.eql(JSON.stringify(['event-name', 'event-arg']));
                    done();
                }
            });
            vm.runInContext(bridgeClient(), context);

            vm.runInContext(`
                bridge.dispatch('event-name', 'event-arg');
            `, context);
        });

        it('must forward dispatch to __uvm_dispatch function', function (done) {
            var context = vm.createContext({
                __uvm_emit: function (message) {
                    expect(arguments.length).be(1);
                    expect(message).be.an('string');
                    expect(message).be.eql(JSON.stringify(['loopback-return', 'event-arg']));
                    done();
                }
            });

            vm.runInContext(bridgeClient(), context);
            vm.runInContext(`
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback-return', data);
                });
            `, context);

            expect(context.__uvm_dispatch).be.a('function');
            context.__uvm_dispatch(JSON.stringify(['loopback', 'event-arg']));
        });

        it('must register event listeners', function () {
            var context = vm.createContext({
                __uvm_emit: function () {
                    throw new Error('Nothing should be emitted');
                },
                expect: expect
            });
            vm.runInContext(bridgeClient(), context);

            vm.runInContext(`
                expect(bridge.on).be.a('function');
                expect(bridge.on.bind(bridge)).withArgs('loopback', function () {}).not.throwError();
            `, context);
        });

        it('must trigger registered event listeners', function (done) {
            var context = vm.createContext({
                expect: expect,
                __uvm_emit: function () {
                    throw new Error('Nothing should be emitted');
                },
                done: function () {
                    expect(arguments.length).be(0);
                    done();
                }
            });
            vm.runInContext(bridgeClient(), context);

            vm.runInContext(`
                bridge.on('loopback', done);
                bridge.emit('loopback');
            `, context);
        });

        it('must trigger multiple registered event listeners in order', function (done) {
            var context = vm.createContext({
                expect: expect,
                __uvm_emit: function () {
                    throw new Error('Nothing should be emitted');
                },
                done: function () {
                    expect(arguments.length).be(0);
                    done();
                }
            });
            vm.runInContext(bridgeClient(), context);

            vm.runInContext(`
                var one = false,
                    two = false;
                bridge.on('loopback', function () {
                    expect(one).be(false);
                    expect(two).be(false);

                    one = true;
                });

                bridge.on('loopback', function () {
                    expect(one).be(true);
                    expect(two).be(false);

                    two = true;
                });

                bridge.on('loopback', function () {
                    expect(one).be(true);
                    expect(two).be(true);

                    done();
                });

                bridge.emit('loopback');
            `, context);
        });

        it('must not leave behind any additional globals except `bridge` related', function (done) {
            var context = vm.createContext({
                __uvm_emit: function () {
                    throw new Error('Nothing should be emitted');
                }
            });
            vm.runInContext(bridgeClient(), context);

            expect(Object.keys(context).sort()).to.eql([
                '__uvm_emit', '__uvm_dispatch', 'bridge'
            ].sort());

            done();
        });

        it('must work after the transport functions are removed from context externally', function (done) {
            var context = vm.createContext({
                expect: expect,
                __uvm_emit: function (args) {
                    expect(args).be('["test","context closures are working"]');
                    done();
                }
            });

            vm.runInContext(bridgeClient(), context);
            vm.runInContext(`
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback-return', data);
                });
            `, context);

            expect(Object.keys(context).sort()).to.eql([
                'expect', '__uvm_emit', '__uvm_dispatch', 'bridge'
            ].sort());

            // deleting stuff / setting to null
            vm.runInContext(`
                __uvm_emit = null;
                __uvm_dispatch = null;
            `, context);

            // check they are deleted
            vm.runInContext(`
                expect(typeof __uvm_dispatch).not.be('undefined');
                expect(__uvm_dispatch).be(null);
                expect(typeof __uvm_emit).not.be('undefined');
                expect(__uvm_emit).be(null);
            `, context);

            // dispatch an event now that the root variables are deleted
            vm.runInContext(`
                bridge.dispatch('test', 'context closures are working');
            `, context);
        });
    });

});
