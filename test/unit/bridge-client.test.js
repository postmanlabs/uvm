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
        var bootcode = 'console.log("hi mocha");';
        expect(bridgeClient(bootcode)).be.a('string').and.contain(bootcode);
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
    });

});
