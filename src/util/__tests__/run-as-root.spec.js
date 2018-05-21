jest.mock('sudo-prompt');
jest.mock('../promisified/child_process');
jest.mock('../global-config');

const sudoPrompt = require('sudo-prompt');
const path = require('path');
const fs = require('../promisified/fs');
const GlobalConfig = require('../global-config');
const { exec } = require('../promisified/child_process');

const implDir = path.resolve(__dirname, '..');
const runAsRoot = require('../run-as-root');

runAsRoot.setFallbackTimeout(0.5);

const mockPreference = {
    none() {
        GlobalConfig.prototype.get.mockResolvedValueOnce(null);
    },
    cli() {
        GlobalConfig.prototype.get.mockResolvedValueOnce('cli');
    }
};

let wasTTY;
const mockNoTTY = {
    enable() {
        wasTTY = process.env.isTTY;
        Object.defineProperty(process.stdout, 'isTTY', {
            value: false,
            configurable: true,
            writable: true
        });
    },
    disable() {
        process.stdout.isTTY = wasTTY;
    }
}

beforeAll(() => GlobalConfig.prototype.set.mockResolvedValue(true));

beforeEach(jest.clearAllMocks);

test('serializes and writes a script to fs', async () => {
    mockPreference.none();
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() => cb(null, '', ''))
    );
    jest.spyOn(fs, 'writeFile').mockResolvedValue();
    jest.spyOn(fs, 'unlink').mockResolvedValue();
    await runAsRoot((x, y) => x + y * 5, 3, 4);
    expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        '((x, y) => x + y * 5)(...[3,4])',
        'utf8'
    );
    expect(path.dirname(fs.writeFile.mock.calls[0][0])).toBe(implDir);
    expect(eval(fs.writeFile.mock.calls[0][1])).toBe(23);
});

test('runs visual sudoPrompt with title and icon', async () => {
    mockPreference.none();
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

test('falls back to CLI sudo prompt if the dialog never settles', async () => {
    mockPreference.none();
    sudoPrompt.exec.mockImplementationOnce(() => {});
    exec.mockResolvedValueOnce({ stdout: 'Plain command line worked' });

    const operation = runAsRoot(x => x);

    expect(await operation).toEqual('Plain command line worked');

    expect(sudoPrompt.exec).toHaveBeenCalled();
    expect(exec).toHaveBeenCalled();
    expect('sudo ' + sudoPrompt.exec.mock.calls[0][0]).toEqual(
        exec.mock.calls[0][0]
    );
});

test('stores a user preference and does not call graphical prompt later', async () => {
    mockPreference.cli();
    exec.mockResolvedValueOnce({ stdout: 'Plain command line worked' });

    const operation = runAsRoot(x => x);

    expect(await operation).toEqual('Plain command line worked');

    expect(sudoPrompt.exec).not.toHaveBeenCalled();
});


test('reports errors informatively', async () => {
    mockPreference.none();
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb(
                new Error('User did not grant permission'),
                'standard error',
                'standard out'
            )
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /User did not grant permission\s+standard out\s+standard error/m
    );
    mockPreference.none();
    sudoPrompt.exec.mockImplementationOnce((cmd, opts, cb) =>
        setImmediate(() =>
            cb('raw error message', 'standard error', 'standard out')
        )
    );
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /raw error message\s+standard out\s+standard error/m
    );
    mockPreference.none();
    sudoPrompt.exec.mockImplementationOnce(() => {});
    exec.mockImplementationOnce(() => Promise.reject({
        stdout: '',
        stderr: '',
        message: 'Oh noooo'
    }));
    await expect(runAsRoot(x => x)).rejects.toThrowError(
        /Oh no/
    );

});

test('detects no TTY and tries to execute directly without privilege escalation', async () => {
    mockNoTTY.enable();
    exec.mockResolvedValueOnce({ stdout: 'Worked no trouble' });
    await expect(runAsRoot(x => 12 + x, 19)).resolves.toMatch('Worked no trouble');
    expect(exec).toHaveBeenCalled();
    expect(exec.mock.calls[0][0]).not.toMatch(/^sudo/);
    mockNoTTY.disable();
});

test('overrides TTY detection behavior with an env var BUILDPACK_FORCE_TTY', async () => {
    sudoPrompt.exec.mockImplementationOnce(() => {});
    mockNoTTY.enable();
    const oldBuildpackVar = process.env.BUILDPACK_FORCE_TTY;
    Object.defineProperty(process.env, 'BUILDPACK_FORCE_TTY', {
        value: 'true',
        writable: true,
        configurable: true
    });
    exec.mockResolvedValueOnce({ stdout: 'Worked no trouble' });
    await expect(runAsRoot(x => 12 + x, 19)).resolves.toMatch('Worked no trouble');
    expect(exec).toHaveBeenCalled();
    expect(exec.mock.calls[0][0]).toMatch(/^sudo/);
    mockNoTTY.disable();
    process.env.BUILDPACK_FORCE_TTY = oldBuildpackVar;
});
