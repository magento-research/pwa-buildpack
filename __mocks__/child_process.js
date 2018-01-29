let __fixtures = new Map();
module.exports = {
    __fixtures,
    execSync: jest.fn().mockImplementation(cmd => {
        for ([re, stdout] of __fixtures.entries()) {
            if (re.test(cmd)) {
                return stdout;
            }
        }
    })
};
