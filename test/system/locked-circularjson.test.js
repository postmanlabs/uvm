var expect = require('expect.js');

// There is a string variant of the library in bridge-client.js
describe('circular-json dependency', function () {
    // To update circular-json, the package needs to be updated and then post installing circular-json, one needs to
    // manually copy node_modules/circular-json/build/circular-json.js.and replace it in where the previous
    // circular-json code existed within lib/uvm/bridge-client.js. Finally, we should replace all backslash "\"
    // characters with double backslash "\\".
    it('must be version locked, unless modified intentionally', function () {
        expect(require('../../package.json').dependencies['circular-json']).be('0.5.5');
    });
});
