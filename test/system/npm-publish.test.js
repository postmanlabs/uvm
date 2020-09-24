const { expect } = require('chai'),
    { exec } = require('shelljs');

describe('npm publish', function () {
    const packageInfo = JSON.parse(exec('npm pack --dry-run --json', { silent: true }).stdout)[0];

    it('should have a valid package name', function () {
        expect(packageInfo.name).to.equal('uvm');
    });

    it('should not publish unnecessary files', function () {
        const allowedFiles = ['index.js', 'package.json', 'LICENSE.md', 'README.md', 'CHANGELOG.yaml'];

        packageInfo.files.map(({ path }) => {
            expect(allowedFiles.includes(path) || path.startsWith('lib/') || path.startsWith('firmware/')).to.be.true;
        });
    });
});
