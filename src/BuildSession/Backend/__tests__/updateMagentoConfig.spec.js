const HostOSAdapter = require('../HostOSAdapter');
let hostMocks;
const updateMagentoConfig = require('../updateMagentoConfig');

const baseDir = 'fakeBaseDir';

beforeAll(() => {
    hostMocks = {
        cwd: 'cwd',
        exec: jest.fn(() => Promise.resolve({ stdout: 'default response' })),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        stat: jest.fn()
    };
});

beforeEach(() => jest.resetAllMocks());

test('runs bin/magento to get and parse current magento config', async () => {
    const hostOS = new HostOSAdapter(hostMocks);
    const requiredConfig = {
        'zerosie/onesie/twosie': 1,
        'threesie/foursie/fivesie': 'right_stuff'
    };
    hostMocks.exec.mockResolvedValueOnce({
        stdout: `
        zerosie/onesie/twosie - 1
        threesie/foursie/fivesie - oh_no_it_is_wrong
        `
    });
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    await updateMagentoConfig({ hostOS, baseDir, requiredConfig });
    const [
        configShow,
        setupUpgrade,
        configSet,
        missingFourthCall
    ] = hostMocks.exec.mock.calls;
    expect(configShow).toContain('bin/magento config:show');
    expect(setupUpgrade).toContain('bin/magento setup:upgrade');
    expect(configSet).toContain(
        'bin/magento config:set threesie/foursie/fivesie right_stuff'
    );
    expect(missingFourthCall).toBeUndefined();
});

test('formats and passes errors from executed commands', async () => {
    const hostOS = new HostOSAdapter(hostMocks);
    hostMocks.exec.mockRejectedValueOnce({
        stderr: 'This went poorly'
    });
    await expect(
        updateMagentoConfig({ baseDir, hostOS, requiredConfig: {} })
    ).rejects.toThrow(
        /Failed to configure Magento.*Error running 'bin\/magento config:show': This went poorly/
    );
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    hostMocks.exec.mockRejectedValueOnce({
        stdout: 'This escalated quickly'
    });
    await expect(
        updateMagentoConfig({ baseDir, hostOS, requiredConfig: {} })
    ).rejects.toThrow(
        /Failed to configure Magento.*Error running 'bin\/magento setup:upgrade': This escalated quickly/
    );
});

test('returns fixture based on env var until module is fully implemented', async () => {
    const hostOS = new HostOSAdapter(hostMocks);
    const requiredConfig = {};
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    hostMocks.exec.mockResolvedValueOnce({
        stdout: ''
    });
    await expect(
        updateMagentoConfig({ hostOS, baseDir, requiredConfig })
    ).resolves.toHaveProperty('publicPath');
});

test.skip('TODO: runs bin/magento dev:pwa:prepare command');

test.skip('TODO: handles errors from dev:pwa:prepare command');
