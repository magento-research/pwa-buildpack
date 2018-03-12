const Environment = require('../Environment');
const BuildSession = require('../');

class FakeFrontend {}
class FakeBackend {}

class DevCapable extends BuildSession {
    static SUPPORTED_MODES = [Environment.Mode.DEVELOPMENT];
    static SUPPORTED_FRONTEND_PROVISIONERS = [FakeFrontend];
    static SUPPORTED_BACKEND_PROVISIONERS = [FakeBackend];
}
DevCapable.prototype.connect = jest.fn();

test('static matches() fails if this Session cannot handle the given env, frontend, and/or backend impls', () => {
    expect(
        BuildSession.matches({
            env: {},
            frontend: {},
            backend: {}
        })
    ).toBeFalsy();
    class KnowsDevMode extends BuildSession {
        static SUPPORTED_MODES = [Environment.Mode.DEVELOPMENT];
    }
    expect(
        KnowsDevMode.matches({
            env: {
                mode: Environment.Mode.DEVELOPMENT
            },
            frontend: {},
            backend: {}
        })
    ).toBeFalsy();
    class FakeFrontend {}
    class KnowsDevModeAndFrontend extends BuildSession {
        static SUPPORTED_MODES = [Environment.Mode.DEVELOPMENT];
        static SUPPORTED_FRONTEND_PROVISIONERS = [FakeFrontend];
    }
    expect(
        KnowsDevModeAndFrontend.matches({
            env: {
                mode: Environment.Mode.DEVELOPMENT
            },
            frontend: new FakeFrontend(),
            backend: {}
        })
    ).toBeFalsy();
});

test('static matches() succeeds if this Session can handle the given env, frontend, and backend', () => {
    expect(
        DevCapable.matches({
            env: {
                mode: Environment.Mode.DEVELOPMENT
            },
            frontend: new FakeFrontend(),
            backend: new FakeBackend()
        })
    ).toBeTruthy();
});

test('static async start() looks for compatible build scenarios registered on BuildSession and requires exactly one', async () => {
    await expect(
        BuildSession.start({
            env: {},
            frontend: {},
            backend: {}
        })
    ).rejects.toThrowError('No compatible build session scenarios');

    BuildSession.Scenarios.DevCapable = DevCapable;
    BuildSession.Scenarios.AlsoDevCapable = DevCapable;
    await expect(
        BuildSession.start({
            env: {
                mode: Environment.Mode.DEVELOPMENT
            },
            frontend: new FakeFrontend(),
            backend: new FakeBackend()
        })
    ).rejects.toThrowError(
        'Found more than one compatible build session scenario'
    );

    delete BuildSession.Scenarios.DevCapable;
    delete BuildSession.Scenarios.AlsoDevCapable;
});

test('static async start() instantiates a compatible scenario and runs its connect() method', async () => {
    BuildSession.Scenarios.DevCapable = DevCapable;
    const session = await BuildSession.start({
        env: {
            mode: Environment.Mode.DEVELOPMENT
        },
        frontend: new FakeFrontend(),
        backend: new FakeBackend()
    });
    expect(session).toBeInstanceOf(DevCapable);
    expect(session.connect).toHaveBeenCalled();
});

test('envToVars returns a hash of environment variables with NODE_ENV at least', async () => {
    BuildSession.Scenarios.DevCapable = DevCapable;
    const session = await BuildSession.start({
        env: {
            mode: Environment.Mode.DEVELOPMENT
        },
        frontend: new FakeFrontend(),
        backend: new FakeBackend()
    });
    expect(session.envToVars()).toMatchObject({
        NODE_ENV: Environment.Mode.DEVELOPMENT
    });
});
