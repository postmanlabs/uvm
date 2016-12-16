describe('uvm errors', function () {
    var uvm = require('../../lib');

    it('must raise an error if sandbox disconnect is somehow broken', function (done) {
        var context = uvm.spawn();

        // delete context._disconnect to further sabotage the bridge
        delete context._disconnect;

        context.on('error', function (err) {
            expect(err).be.ok();
            expect(err).to.have.property('message', 'uvm: cannot disconnect, communication bridge is broken');
            done();
        });

        context.disconnect(null);
    });

    // @todo find a way to fix this
    it('must fail to dispatch cyclic object', function (done) {
        var context = uvm.spawn({
                bootcode: `
                    bridge.on('loopback', function (data) {
                        bridge.dispatch('loopback', data);
                    });
                `
            }),

            cyclic,
            subcycle;

        context.on('error', function (err) {
            expect(err).be.ok();
            expect(err).to.have.property('name', 'TypeError');
            expect(err).to.have.property('message', 'Converting circular structure to JSON');
            done();
        });

        cyclic = {};
        subcycle = {c1: cyclic};
        cyclic.c2 = subcycle;

        context.dispatch('loopback', cyclic);
    });
});
