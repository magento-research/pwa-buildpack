jest.mock('../../../../util/promisified/fs');
jest.mock('../../../../util/promisified/child_process');

// complex mocks
const baseDir = '/some/great/dir';
const pkg = {};
jest.doMock(`${baseDir}/package.json`, () => pkg, { virtual: true });
function mockPkg(json) {
    Object.keys(pkg).forEach(k => {
        delete pkg[k];
    });
    return Object.assign(pkg, json);
}
// mock references
const fs = require('../../../../util/promisified/fs');
const { exec } = require('../../../../util/promisified/child_process');
// real modules
const path = require('path');
const semver = require('semver');
// alternate parser from our prod code, so we can test to spec and not to lib
const parseXML = require('@rgrove/parse-xml');
const Environment = require('../../../Environment');
// fixtures
const viewXmlTxt = require('fs').readFileSync(
    path.resolve(__dirname, '../../__fixtures__/view.xml'),
    'utf8'
);
const emptyViewXmlTxt = require('fs').readFileSync(
    path.resolve(__dirname, '../../__fixtures__/view-novars.xml'),
    'utf8'
);
const npmLsDeps = require('../../__fixtures__/npm-ls-dependencies.json');

// under test
const PeregrineApp = require('../PeregrineApp');
const PeregrineDev = PeregrineApp[Environment.Mode.DEVELOPMENT];

async function mockProvWithViewXml(txt) {
    fs.readFile.mockResolvedValueOnce(txt);
    const prov = new PeregrineDev();
    prov.config = { baseDir };
    prov.paths = await prov.nowResolvePaths();
    return prov;
}

test('PeregrineDev has REQUIRED_PATHS and REQUIRED_DEPENDENCIES matching peregrine needs', () => {
    expect(PeregrineDev.REQUIRED_PATHS).toBeInstanceOf(Object);
    const RDeps = PeregrineDev.REQUIRED_DEPENDENCIES;
    expect(RDeps).toBeInstanceOf(Object);
    Object.keys(RDeps).forEach(key => {
        expect(semver.validRange(RDeps[key], true)).toBeTruthy();
    });
});

test('async dev#nowResolvePaths() resolves and verifies all paths with stat', async () => {
    const RPaths = PeregrineDev.REQUIRED_PATHS;
    const RPKeys = Object.keys(RPaths);

    let prov;

    fs.stat.mockResolvedValue(true);

    // all paths resolve
    prov = new PeregrineDev();
    prov.config = { baseDir };
    const resolved = await prov.nowResolvePaths();
    RPKeys.forEach(k => {
        expect(path.isAbsolute(resolved[k])).toBeTruthy();
        expect(resolved[k].indexOf(baseDir)).toBe(0);
    });

    // not all paths resolve
    prov = new PeregrineDev();
    prov.config = { baseDir };
    fs.stat.mockResolvedValueOnce(true);
    fs.stat.mockRejectedValueOnce({ message: 'ohh nooooo' });
    const broke = { name: RPKeys[1], relpath: RPaths[RPKeys[1]] };
    await expect(prov.nowResolvePaths()).rejects.toThrow(
        new RegExp(
            `A Peregrine app requires the ${broke.name} path ${
                broke.relpath
            } to be present`
        )
    );
});

test('async dev#nowResolveDependencies() gets dep graph from NPM', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    exec.mockResolvedValueOnce(JSON.stringify(npmLsDeps));
    await prov.nowResolveDependencies();
    expect(exec).toHaveBeenCalledWith(`npm ls --depth=1 --json`, {
        cwd: baseDir
    });
});

test('async dev#nowResolveDependencies() handles errors from dep list', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    exec.mockRejectedValueOnce({
        stdout: JSON.stringify(npmLsDeps),
        stderr: 'Validity warning'
    });
    const report = await prov.nowResolveDependencies();
    expect(report.validityWarning).toBe('Validity warning');
});

test('async dev#nowResolveDependencies() tests each dep for semver validity', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    exec.mockRejectedValueOnce({
        stdout: JSON.stringify({
            dependencies: {
                react: {
                    version: '15.0.0'
                },
                redux: {
                    version: '3.7.2'
                }
            }
        }),
        stderr: 'Beginning of validity warning'
    });
    const report = await prov.nowResolveDependencies();
    expect(report.valid).toHaveLength(1);
    expect(report.valid[0]).toBe('redux');
    expect(report.invalid).toHaveLength(
        Object.keys(PeregrineDev.REQUIRED_DEPENDENCIES).length -
            report.valid.length
    );
    expect(report.validityWarning).toMatch(/^Beginning of validity warning/);
});

test('async dev#nowIdentify() runs super method and normalizes id', async () => {
    mockPkg({
        config: {
            magentoTheme: {
                name: 'Identifies',
                vendor: 'Self'
            }
        }
    });
    const prov = new PeregrineDev();
    prov.config = { baseDir };
    await expect(prov.nowIdentify()).resolves.toBe('self-identifies');
});

test('async dev#readViewConfig reads view.xml config', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    await prov.readViewConfig();
    expect(fs.readFile).toHaveBeenCalledWith(prov.paths.viewxml);
    await expect(prov.getViewConfigValue('serviceworker_name')).resolves.toBe(
        'sw.js'
    );
});

test('async dev#readViewConfig normalizes view.xml config', async () => {
    const prov = await mockProvWithViewXml(emptyViewXmlTxt);
    await prov.readViewConfig();
    expect(fs.readFile).toHaveBeenCalledWith(prov.paths.viewxml);
    await expect(
        prov.getViewConfigValue('serviceworker_name')
    ).resolves.toBeFalsy(); // does not reject
});

test('async dev#getViewConfigValue runs readViewConfig first if it must', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    await expect(prov.getViewConfigValue('serviceworker_name')).resolves.toBe(
        'sw.js'
    );
});

test('async dev#writeViewConfig writes updated view.xml back out', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    await prov.readViewConfig();
    await prov.writeViewConfig({
        extravar: 'foo',
        serviceworker_name: 'service-worker.js'
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
        prov.paths.viewxml,
        expect.any(String), // we will look at it
        'utf8'
    );
    function getVarHash(xml) {
        return parseXML(xml)
            .children.find(c => c.name === 'view')
            .children.find(
                c => c.name === 'vars' && c.attributes.module === 'Magento_Pwa'
            )
            .children.filter(c => c.name === 'var')
            .reduce((out, node) => {
                out[node.attributes.name] = node.children[0].text;
                return out;
            }, {});
    }
    const originalVars = getVarHash(viewXmlTxt);
    expect(originalVars).not.toHaveProperty('extravar');
    const updatedVars = getVarHash(fs.writeFile.mock.calls[0][1]);
    expect(updatedVars).toMatchObject(
        Object.assign({}, originalVars, {
            serviceworker_name: 'service-worker.js'
        })
    );
    expect(updatedVars).toHaveProperty('extravar', 'foo');
});

test('async dev#writeViewConfig runs readViewConfig first if it must', async () => {
    const prov = await mockProvWithViewXml(viewXmlTxt);
    await prov.writeViewConfig({});
    expect(fs.readFile).toHaveBeenCalled();
});
