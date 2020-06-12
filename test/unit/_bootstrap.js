var _expect;

/* eslint-disable mocha/no-top-level-hooks */
before(function () {
    global.expect && (_expect = global.expect);
    global.expect = require('chai').expect;
});

after(function () {
    _expect ? (global.expect = _expect) : (delete global._expect);
    _expect = null;
});
/* eslint-enable mocha/no-top-level-hooks */
