const expect = require('chai').expect;

// There is a string variant of the library in bridge-client.js
describe('flatted dependency', function () {
    // To update flatted, the package needs to be updated and then post
    // installing flatted, one needs to manually copy 'node_modules/flatted/min.js'
    // and replace it in where the previous flatted code existed within
    // 'lib/bridge-client.js'. Finally, we should replace all backslash "\"
    // characters with double backslash "\\". (if any)
    it('should be version locked, unless modified intentionally', function () {
        expect(require('../../package.json').dependencies.flatted).to.equal('3.2.6');
    });
});
