const expect = require('chai').expect,
    uvm = require('../../lib');

describe('uvm', function () {
    it('should connect a new context', function (done) {
        uvm.spawn({}, done);
    });

    it('should dispatch all the pending messages in FIFO order', function (done) {
        let vm = new uvm(),
            loopbackData = [];

        vm.on('error', done);
        vm.on('loopback', (data) => {
            loopbackData.push(data);
        });
        vm.on('disconnect', () => {
            expect(loopbackData).to.eql([1, 2, 3, 4]);
            vm.disconnect();
            done();
        });

        // dispatch before connect
        vm.dispatch('loopback', 1);
        vm.dispatch('loopback', 2);
        vm.dispatch('loopback', 3);

        vm.connect({
            bootCode: `
                bridge.on('disconnect', function () {
                    bridge.dispatch('disconnect');
                });

                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, (err) => {
            if (err) {
                return done(err);
            }

            vm.dispatch('loopback', 4);
            vm.dispatch('disconnect');
        });
    });

    describe('context', function () {
        it('should have event emitter interface and .dispatch method', function () {
            var context = uvm.spawn();

            expect(context).to.be.ok;
            expect(context).to.have.property('dispatch').that.is.a('function');
            expect(context).to.have.property('emit').that.is.a('function');
            expect(context).to.have.property('on').that.is.a('function');
            expect(context).to.have.property('connect').that.is.a('function');
            expect(context).to.have.property('disconnect').that.is.a('function');
        });

        it('should allow dispatching events to context', function () {
            var context = uvm.spawn();

            context.dispatch();
            context.dispatch('event-name');
            context.dispatch('event-name', 'event-arg');
        });

        it('should allow receiving events in context', function (done) {
            var sourceData = 'test',
                context = uvm.spawn({
                    bootCode: `
                        bridge.on('loopback', function (data) {
                            bridge.dispatch('loopback', data);
                        });
                    `
                });

            context.on('loopback', function (data) {
                expect(data).to.equal('test');
                done();
            });

            context.dispatch('loopback', sourceData);
        });

        it('should not overflow dispatches when multiple vm is run', function (done) {
            // create two vms
            uvm.spawn({
                bootCode: `
                    bridge.on('loopback', function (data) {
                        bridge.dispatch('loopback', 0, data);
                    });
                `
            }, function (err, context0) {
                expect(err).to.be.null;

                uvm.spawn({
                    bootCode: `
                        bridge.on('loopback', function (data) {
                            bridge.dispatch('loopback', 1, data);
                        });
                    `
                }, function (err, context1) {
                    expect(err).to.be.null;

                    context0.on('loopback', function (source, data) {
                        expect(source).to.equal(0);
                        expect(data).to.equal('zero');

                        setTimeout(done, 100); // wait for other events before going done
                    });

                    context1.on('loopback', function () {
                        expect.fail('second context receiving message overflowed from first');
                    });

                    context0.dispatch('loopback', 'zero');
                });
            });
        });

        it('should restore dispatcher if it is deleted', function (done) {
            uvm.spawn({
                bootCode: `
                    bridge.on('deleteDispatcher', function () {
                        __uvm_dispatch = null;
                    });

                    bridge.on('loopback', function (data) {
                        bridge.dispatch('loopback', data);
                    });
                `
            }, function (err, context) {
                expect(err).to.be.null;

                context.on('error', done);
                context.on('loopback', function (data) {
                    expect(data).to.equal('this returns');
                    done();
                });

                context.dispatch('deleteDispatcher');
                context.dispatch('loopback', 'this returns');
            });
        });

        it('should allow reconnecting from the same context', function (done) {
            let loopbackData = [],
                bootCode = `
                bridge.on('disconnect', function () {
                    bridge.dispatch('disconnect');
                });

                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `;

            uvm.spawn({ bootCode }, (err, context) => {
                if (err) { return done(err); }

                context.on('loopback', (data) => { loopbackData.push(data); });
                context.on('disconnect', () => {
                    expect(loopbackData).to.eql([1, 2]);
                    context.disconnect();
                    done();
                });

                context.dispatch('loopback', 1);

                setTimeout(() => {
                    context.disconnect();

                    // reconnect
                    context.connect({ bootCode }, (err) => {
                        if (err) { return done(err); }
                        context.dispatch('loopback', 2);
                        context.dispatch('disconnect');
                    });
                }, 100);
            });
        });

        it('should not create multiple connection on same instance', function (done) {
            let vm = new uvm();

            vm.on('loopback', (data) => {
                expect(data).to.equal('first');
                vm.disconnect();
                done();
            });

            vm.connect({
                bootCode: 'bridge.on("loopback", () => bridge.dispatch("loopback", "first"))'
            }, (err) => {
                if (err) { return done(err); }

                vm.connect({
                    bootCode: 'bridge.on("loopback", () => bridge.dispatch("loopback", "second"))'
                }, (err, context) => {
                    if (err) { return done(err); }

                    context.dispatch('loopback');
                });
            });
        });
    });
});
