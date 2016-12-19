describe('uvm', function () {
    var uvm = require('../../lib');

    it('must connect a new context', function (done) {
        uvm.spawn({}, done);
    });

    describe('context', function () {
        it('must have event emitter interface and .dispatch method', function () {
            var context = uvm.spawn();

            expect(context).be.ok();
            expect(context).to.have.property('dispatch');
            expect(context.dispatch).be.a('function');
            expect(context).to.have.property('emit');
            expect(context.emit).be.a('function');
            expect(context).to.have.property('on');
            expect(context.on).be.a('function');
            expect(context).to.have.property('disconnect');
            expect(context.disconnect).be.a('function');
        });

        it('must allow dispatching events to context', function () {
            var context = uvm.spawn();

            context.dispatch();
            context.dispatch('event-name');
            context.dispatch('event-name', 'event-arg');
        });

        it('must allow receiving events in context', function (done) {
            var sourceData = 'test',
                context = uvm.spawn({
                    bootcode: `
                        bridge.on('loopback', function (data) {
                            bridge.dispatch('loopback', data);
                        });
                    `
                });

            context.on('loopback', function (data) {
                expect(data).be('test');
                done();
            });

            context.dispatch('loopback', sourceData);
        });

        ((typeof window === 'undefined') ? it : it.skip)('must pass load error on broken boot code', function (done) {
            uvm.spawn({
                bootcode: `
                    throw new Error('error in bootcode');
                `
            }, function (err) {
                expect(err).be.an('object');
                expect(err).have.property('message', 'error in bootcode');
                done();
            });
        });
    });
});
