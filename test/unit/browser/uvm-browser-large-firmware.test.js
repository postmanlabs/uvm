/* eslint-disable mocha/no-top-level-hooks */
(typeof window !== 'undefined' ? describe : describe.skip)('custom sandbox in browser', function () {
    const uvm = require('../../../lib'),
        expect = require('chai').expect,

        /**
         * Creates a large string with a given character length.
         *
         * @param {Number} size -
         *
         * @returns {String}
         */
        getLargeString = function (size) {
            return 'a'.repeat(size);
        },
        getFirmware = function (code) {
            return `
                ${code}
                (function (self) {
                    var init = function (e) {
                        self.removeEventListener('message', init);
                        // eslint-disable-next-line no-eval
                        (e && e.data && (typeof e.data.__init_uvm === 'string')) && eval(e.data.__init_uvm);
                    };
                    self.addEventListener('message', init);
                }(self));
            `;
        };

    let firmwareUrl,
        worker;

    beforeEach(function () {
        const fakeBundleSize = 5 * 1024 * 1024, // 10MB (5 million characters with 2 bytes each)
            largeJSStatement = `var x = '${getLargeString(fakeBundleSize)}';`;

        firmwareUrl = window.URL.createObjectURL(new Blob([
            getFirmware(largeJSStatement)
        ], { type: 'text/javascript' }));

        worker = new Worker(firmwareUrl);
    });

    afterEach(function () {
        worker.terminate();
        window.URL.revokeObjectURL(firmwareUrl);
        worker = firmwareUrl = null;
    });

    it('should load and dispatch messages', function (done) {
        uvm.spawn({
            _sandbox: worker,
            bootCode: `
                bridge.on('loopback', function (data) {
                    bridge.dispatch('loopback', data);
                });
            `
        }, function (err, context) {
            if (err) { return done(err); }

            context.on('loopback', function (data) {
                expect(data).to.equal('this should return');
                done();
            });
            context.dispatch('loopback', 'this should return');
        });
    });
});
