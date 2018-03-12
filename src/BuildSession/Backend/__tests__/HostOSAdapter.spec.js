jest.mock('../../../util/promisified');

const { fs, child_process: { exec } } = require('../../../util/promisified');
const HostOSAdapter = require('../HostOSAdapter');

test('constructs from default implementations of system calls', () => {
    const adapter = new HostOSAdapter();
    expect(adapter._exec).toBe(exec);
    expect(adapter._readFile).toBe(fs.readFile);
    expect(adapter._writeFile).toBe(fs.writeFile);
    expect(adapter._stat).toBe(fs.stat);
});

test('constructs from alternate implementations of system calls', () => {
    const fakey = {
        exec: {},
        readFile: {},
        writeFile: {},
        stat: {}
    };
    const adapter = new HostOSAdapter(fakey);
    expect(adapter._exec).toBe(fakey.exec);
    expect(adapter._readFile).toBe(fakey.readFile);
    expect(adapter._writeFile).toBe(fakey.writeFile);
});

test('async connect() confirms cwd exists with bash command', async () => {
    const adapter = new HostOSAdapter();
    exec.mockRejectedValueOnce('aaaaa');
    await expect(adapter.connect()).rejects.toThrowError(
        'hostOS did not report that "undefined" is a directory.'
    );
    exec.mockResolvedValueOnce({ stdout: 'nice' });
    await expect(adapter.connect()).resolves.not.toThrow();
});

test('async exec() runs exec implementation and expects a resolved { stdout }', async () => {
    const adapter = new HostOSAdapter();
    exec.mockResolvedValueOnce({ stdout: 'nice' });
    await expect(adapter.exec()).resolves.toBe('nice');
});

test('async exec() merges options', async () => {
    const adapter = new HostOSAdapter();
    exec.mockResolvedValueOnce({ stdout: 'nice' });
    await expect(
        adapter.exec('cmd', { cwd: 'dang', what: 'oh' })
    ).resolves.toBe('nice');
    expect(exec).toHaveBeenCalledWith(
        'cmd',
        expect.objectContaining({
            encoding: 'utf8',
            cwd: 'dang',
            what: 'oh'
        })
    );
});

test('async exec() passes errors', async () => {
    const adapter = new HostOSAdapter();
    exec.mockRejectedValueOnce('aaaaa');
    await expect(adapter.exec()).rejects.toThrow('aaaaa');
});

test('async readFile() runs readFile implementation', async () => {
    const adapter = new HostOSAdapter();
    fs.readFile.mockResolvedValueOnce('hey');
    await expect(adapter.readFile('somepath')).resolves.toBe('hey');
    expect(fs.readFile).toHaveBeenCalledWith(
        'somepath',
        expect.objectContaining({
            encoding: 'utf8'
        })
    );
});

test('async writeFile() runs mkdir -p to create dir if necessary', async () => {
    const adapter = new HostOSAdapter();
    fs.stat.mockRejectedValueOnce({ code: 'ENOENT' });
    exec.mockResolvedValueOnce(true);
    await expect(
        adapter.writeFile('/somepath/somefile.ext', 'yo')
    ).resolves.not.toThrow();
    expect(fs.stat).toHaveBeenCalledWith('/somepath');
    expect(exec).toHaveBeenCalledWith(
        'mkdir -p /somepath',
        expect.objectContaining({
            encoding: 'utf8'
        })
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
        '/somepath/somefile.ext',
        'yo',
        expect.objectContaining({
            encoding: 'utf8'
        })
    );
});

test('async writeFile() passes errors', async () => {
    const adapter = new HostOSAdapter();
    fs.stat.mockRejectedValueOnce({ code: 'WAT' });
    await expect(
        adapter.writeFile('/somepath/somefile.ext', 'yo')
    ).rejects.toThrow();
});
