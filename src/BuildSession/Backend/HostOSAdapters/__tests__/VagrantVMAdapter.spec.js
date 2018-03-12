jest.mock('../../../../util/promisified');

const { child_process: { exec }, fs } = require('../../../../util/promisified');
const {
    globalStatusOutput,
    bustedColumns,
    parsedMachines,
    nonUniqueName
} = require('../__fixtures__/vagrant-cli-responses.json');
const HostOSAdapter = require('../../HostOSAdapter');
const VagrantVMAdapter = require('../VagrantVMAdapter');

const vmName = 'magento2.vagrant89';
const cwd = parsedMachines.find(v => v.name === vmName).directory;

function mockGoodConnect() {
    exec.mockResolvedValueOnce({
        stdout: globalStatusOutput
    });
    exec.mockResolvedValueOnce({ stdout: '/virtual/magento/root' });
    exec.mockResolvedValueOnce({ stdout: '' });
}

test('extends HostOSAdapter and implements same methods', () => {
    const adapter = new VagrantVMAdapter({ vmName });
    expect(adapter).toBeInstanceOf(HostOSAdapter);
    expect(adapter.vm).toMatchObject({ name: vmName });
});

test('async connect() creates a vm proxy, checks vagrant global status', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    mockGoodConnect();
    await adapter.connect();
    const [
        globalStatusCall,
        directoryConfirmationCall,
        echoRootCall,
        missingFourth
    ] = exec.mock.calls;
    expect(globalStatusCall).toEqual(['vagrant global-status', undefined]);
    expect(directoryConfirmationCall).toEqual([
        "vagrant ssh -c 'cd $MAGENTO_ROOT && echo $MAGENTO_ROOT' -- -T",
        { cwd }
    ]);
    expect(echoRootCall).toEqual([
        'vagrant ssh -c \'cd $MAGENTO_ROOT && [ -d "/virtual/magento/root" ]\' -- -T',
        { cwd }
    ]);
    expect(missingFourth).toBeUndefined();
});

test('async connect() handles bad or unexpected output from vagrant status cmd', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    exec.mockResolvedValueOnce({
        stdout: 'nope'
    });
    exec.mockResolvedValueOnce({
        stdout: bustedColumns
    });
    await expect(adapter.connect()).rejects.toThrow(/Unrecognized input: nope/);
    await expect(adapter.connect()).rejects.toThrow(/Expected .* to match .*/);
});

test('async connect() throws if no machine matches', async () => {
    const nomatch = new VagrantVMAdapter({ vmName: 'nope' });
    exec.mockResolvedValueOnce({
        stdout: globalStatusOutput
    });
    await expect(nomatch.connect()).rejects.toThrow(
        /could not find a machine named/
    );
});

test('async connect() throws if >1 machines match vm name', async () => {
    const twomatch = new VagrantVMAdapter({ vmName: nonUniqueName });
    exec.mockResolvedValueOnce({
        stdout: globalStatusOutput
    });
    await expect(twomatch.connect()).rejects.toThrow(
        /found \d machines named/i
    );
});

test('vm.machine object reflects machine metadata', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    mockGoodConnect();
    await adapter.connect();
    expect(adapter.vm.machine).toMatchObject({
        id: expect.any(String),
        name: vmName,
        provider: expect.any(String),
        state: expect.any(String),
        directory: cwd
    });
});

test('async readFile tunnels through shell exec', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    mockGoodConnect();
    await adapter.connect();
    exec.mockResolvedValueOnce({
        stdout: 'contents'
    });
    const contents = await adapter.readFile('filename');
    expect(contents).toBe('contents');
    expect(exec).toHaveBeenLastCalledWith(
        "vagrant ssh -c 'cd $MAGENTO_ROOT && sudo cat filename' -- -T",
        { cwd }
    );
});

test('async writeFile() uses proxy files to pass through network share', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    mockGoodConnect();
    exec.mockResolvedValueOnce({
        stdout: ''
    });
    exec.mockResolvedValueOnce({
        stdout: ''
    });
    exec.mockResolvedValueOnce({
        stdout: ''
    });
    await adapter.connect();
    await adapter.writeFile('/somepath/anothersegment', 'words');
    expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${adapter.vm.machine.directory}/etc/T`),
        'words',
        'utf8'
    );
    expect(exec).toHaveBeenCalledWith(
        `vagrant ssh -c 'cd $MAGENTO_ROOT && sudo mkdir -p /somepath' -- -T`,
        expect.objectContaining({
            cwd: adapter.vm.machine.directory
        })
    );
    expect(exec).toHaveBeenCalledWith(
        expect.stringContaining(
            `vagrant ssh -c 'cd $MAGENTO_ROOT && sudo cp /vagrant/etc/`
        ),
        expect.objectContaining({
            cwd: adapter.vm.machine.directory
        })
    );
    expect(fs.unlink).toHaveBeenCalled();
});

test('async stat() passes through shell exec, handles errors', async () => {
    const adapter = new VagrantVMAdapter({ vmName });
    mockGoodConnect();
    await adapter.connect();
    exec.mockResolvedValueOnce('');
    await expect(adapter.stat('somewhere')).resolves.not.toThrow();
    exec.mockRestore();
    exec.mockRejectedValueOnce(Error('No such etc'));
    await expect(adapter.stat('somewhen')).rejects.toThrow();
    exec.mockRejectedValueOnce({
        message: '',
        stderr: 'No such etc'
    });
    await expect(adapter.stat('somewho')).rejects.toThrow();
    exec.mockRestore();
    exec.mockImplementationOnce(() => {
        const e = Error('wuhhhhh');
        e.stderr = '';
        throw e;
    });
    await expect(adapter.stat('somehow')).resolves.toBeUndefined();
});
