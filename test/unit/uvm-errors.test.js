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

    it('must dispatch cyclic object', function (done) {
        var context = uvm.spawn({
                bootcode: `
                    bridge.on('transfer', function (data) {
                        bridge.dispatch('transfer', data);
                    });
                `
            }),

            cyclic,
            subcycle;

        context.on('error', done);
        context.on('transfer', function (data) {
            expect(data).be.an('object');
            expect(data).have.property('child');
            expect(data.child).have.property('parent');
            expect(data.child.parent).eql(data);
            done();
        });

        // create a cyclic object
        cyclic = {};
        subcycle = {parent: cyclic};
        cyclic.child = subcycle;

        context.dispatch('transfer', cyclic);
    });
});
