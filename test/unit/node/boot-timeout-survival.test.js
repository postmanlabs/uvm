const { spawnSync } = require('child_process'),
    path = require('path'),
    expect = require('chai').expect,

    UVM_PATH = path.resolve(__dirname, '..', '..', '..', 'lib'),

    // Runs `code` in a fresh Node process, with `uvm` in scope, so that an unhandled rejection that would
    // terminate the host process can be observed through the exit code instead of failing the test runner.
    runInChildProcess = (code) => {
        return spawnSync(process.execPath, ['-e', `const uvm = require(${JSON.stringify(UVM_PATH)}); ${code}`], {
            encoding: 'utf8',
            timeout: 20000
        });
    };

describe('boot timeout and disconnect without a callback', function () {
    it('should not crash the host process when the boot timer terminates the worker', function () {
        const result = runInChildProcess(`
            uvm.spawn({ bootTimeout: 50, bootCode: 'while(1) {}' }, (err) => {
                console.log(err && err.message);

                // give a late unhandled rejection a chance to surface before exiting normally
                setTimeout(() => { console.log('survived'); }, 500);
            });
        `);

        expect(result.stderr).to.not.include('callback is not a function');
        expect(result.stdout).to.include('uvm: boot timed out after 50ms.');
        expect(result.stdout).to.include('survived');
        expect(result.status).to.equal(0);
    });

    it('should not crash the host process when disconnect is called without a callback', function () {
        const result = runInChildProcess(`
            uvm.spawn({}, (err, context) => {
                context.disconnect();
                setTimeout(() => { console.log('survived'); }, 500);
            });
        `);

        expect(result.stderr).to.not.include('callback is not a function');
        expect(result.stdout).to.include('survived');
        expect(result.status).to.equal(0);
    });

    it('should still call the disconnect callback when one is provided', function (done) {
        require(UVM_PATH).spawn({}, (err, context) => {
            if (err) { return done(err); }

            context.disconnect(done);
        });
    });
});
