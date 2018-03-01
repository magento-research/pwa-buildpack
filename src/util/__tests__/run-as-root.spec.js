jest.mock('../promisified/fs');
jest.mock('sudo-prompt');

const sudoPrompt = require('sudo-prompt');
const path = require('path');
const { writeFile } = require('../promisified/fs');

const implDir = path.resolve(__dirname, '..');

const runAsRoot = require('../run-as-root');

test('serializes and writes a script to fs', async () => {
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() => cb(null, '', ''))
    );
    await runAsRoot((x, y) => x + y * 5, 3, 4);
    expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        '((x, y) => x + y * 5)(...[3,4])',
        'utf8'
    );
    expect(path.dirname(writeFile.mock.calls[0][0])).toBe(implDir);
    expect(eval(writeFile.mock.calls[0][1])).toBe(23);
});

test('reports errors informatively', async () => {
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb(new Error('the error message'), 'standard error', 'standard out')
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /the error message\s+standard out\s+standard error/m
    );
});
