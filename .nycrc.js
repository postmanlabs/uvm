const TEST_TYPE = ((argv) => {
    let match = argv[argv.length - 1].match(/npm\/test-(\w+).js/);

    return match && match[1] || '';
})(process.argv);

function configOverrides(testType) {
    switch (testType) {
        case 'unit':
            return {
                statements: 65,
                branches: 45,
                functions: 65,
                lines: 65
            };
        default:
            return {}
    }
}

module.exports = {
    all: true,
    'check-coverage': true,
    'report-dir': '.coverage',
    'temp-dir': '.nyc_output',
    include: ['lib/**/*.js'],
    reporter: ['lcov', 'json', 'text', 'text-summary'],
    ...configOverrides(TEST_TYPE),
};
