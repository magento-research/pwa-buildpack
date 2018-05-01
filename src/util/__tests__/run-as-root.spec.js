jest.mock('../promisified/fs');
jest.mock('sudo-prompt');

const sudoPrompt = require('sudo-prompt');
const path = require('path');
const { writeFile, unlink } = require('../promisified/fs');
const fs = require.requireActual('../promisified/fs');
const { exec } = require('../promisified/child_process');

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

test('runs visual sudoPrompt with title and icon', async () => {
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() => cb(null, '', ''))
    );
    await runAsRoot((x, y) => x + y * 5, 3, 4);
    expect(sudoPrompt.exec).toHaveBeenCalledWith(
        expect.stringContaining('node'),
        expect.objectContaining({
            name: 'Magento PWA Studio',
            icns: expect.any(String)
        }),
        expect.any(Function)
    );
    const { icns } = sudoPrompt.exec.mock.calls[0][1];
    await expect(fs.stat(icns)).resolves.toBeTruthy();
});

test('reports errors informatively', async () => {
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb(
                new Error('object error message'),
                'standard error',
                'standard out'
            )
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /object error message\s+standard out\s+standard error/m
    );
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb('raw error message', 'standard error', 'standard out')
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /raw error message\s+standard out\s+standard error/m
    );
});

test('cleans up temp file on success or failure', async () => {
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        exec(cmd).then(res => cb(null, res.stdout, res.stderr), cb)
    );
    writeFile.mockImplementation(fs.writeFile);
    unlink.mockImplementation(fs.unlink);
    await runAsRoot(() => console.log('squanch'));
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledTimes(1);
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb(new Error('the error message'), 'standard error', 'standard out')
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError();
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(unlink).toHaveBeenCalledTimes(2);
    writeFile.mock.calls.forEach((call, index) =>
        expect(call[0]).toEqual(unlink.mock.calls[index][0])
    );
});
