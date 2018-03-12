const HasLifecycle = require('../HasLifecycle');

const env = {
    emit: jest.fn()
};

class TestProvisioner {}
TestProvisioner.prototype.nowConfigure = jest.fn();
TestProvisioner.prototype.nowFoo = jest.fn();

const Runnable = HasLifecycle(TestProvisioner, {
    lifecycle: [
        {
            name: 'foo',
            async run(self, cb) {
                self.bar = await cb('woah');
            }
        }
    ]
});

beforeEach(() => jest.resetAllMocks());

test('takes a class and a spec object, returns subclass with static async run()', () => {
    expect(Runnable.prototype).toBeInstanceOf(TestProvisioner);
    expect(Runnable.run).toBeInstanceOf(Function);
});

test('run() checks for nowConfigure instance method', async () => {
    await expect(Runnable.run(class {}, env, {})).rejects.toThrowError(
        'missing required methods'
    );
    await expect(
        Runnable.run(TestProvisioner, env, {})
    ).resolves.toBeInstanceOf(TestProvisioner);
});

test('run() checks for instance methods matching spec', async () => {
    class MissingFoo {
        nowConfigure() {}
    }
    await expect(Runnable.run(MissingFoo, env, {})).rejects.toThrowError(
        'nowFoo'
    );
});

test('custom validator falls through if it does not explicitly throw', async () => {
    const validate = jest.fn(() => false);
    const CustomValidatingRunnable = HasLifecycle(TestProvisioner, {
        lifecycle: [],
        validate
    });
    class Empty {}
    await expect(
        CustomValidatingRunnable.run(Empty, env, {})
    ).rejects.toThrowError('nowConfigure');
    expect(validate).toHaveBeenCalledWith(expect.any(Empty));
});
// skips validation, so fails when no configure
test('custom validator runs and throws', async () => {
    const CustomValidatingRunnable = HasLifecycle(TestProvisioner, {
        lifecycle: [],
        validate() {
            throw Error('custom error');
        }
    });
    class Empty {}
    await expect(
        CustomValidatingRunnable.run(Empty, env, {})
    ).rejects.toThrowError('custom error');
});

test('custom validator explicitly returns true to short circuit', async () => {
    // fails at calling nowConfigure because it never checked it
    const CustomValidatingRunnable = HasLifecycle(TestProvisioner, {
        lifecycle: [],
        validate() {
            return true;
        }
    });
    class Empty {}
    await expect(
        CustomValidatingRunnable.run(Empty, env, {})
    ).rejects.toThrowError('not a function');
});

test('run() executes methods in spec, with wrapper logic and events', async () => {
    const config = {};
    const lifecycle = ['one', 'two', 'three'].map((x, i) => ({
        name: x,
        run: jest.fn(async (self, cb) => {
            self[x] = await cb();
            const previous = lifecycle[i - 1];
            const next = lifecycle[i + 1];
            if (previous) {
                expect(previous.run).toHaveBeenCalled();
            }
            if (next) {
                expect(next.run).not.toHaveBeenCalled();
            }
        })
    }));
    function Sequential() {}
    Object.assign(Sequential.prototype, {
        nowConfigure: jest.fn(async cfg => {
            expect(cfg).toBe(config);
            lifecycle.forEach(({ run }) => expect(run).not.toHaveBeenCalled());
        }),
        nowOne: () => 1,
        nowTwo: () => 2,
        nowThree: () => 3
    });
    const RunnableSeq = HasLifecycle(Sequential, {
        lifecycle
    });
    const instance = await RunnableSeq.run(Sequential, env, config);
    expect(instance.one).toBe(1);
    expect(instance.two).toBe(2);
    expect(instance.three).toBe(3);
    expect(instance.nowConfigure).toHaveBeenCalledWith(config);
});

test('run() executes steps marked parallel in parallel', async () => {
    const lifecycle = ['four', 'five', 'six'].map((x, i) => ({
        name: x,
        parallel: true,
        run: jest.fn(async (self, cb) => {
            const previous = lifecycle[i - 1];
            const next = lifecycle[i + 1];
            if (previous) {
                expect(previous.run).toHaveBeenCalled();
            }
            if (next) {
                expect(next.run).not.toHaveBeenCalled();
            }
            self[x] = await cb();
            if (next) {
                expect(next.run).toHaveBeenCalled();
            }
        })
    }));
    function Parallel() {}
    Object.assign(Parallel.prototype, {
        nowConfigure: jest.fn(async () => {
            lifecycle.forEach(({ run }) => expect(run).not.toHaveBeenCalled());
        }),
        nowFour: () => 4,
        nowFive: () => 5,
        nowSix: () => 6
    });
    const RunnableParallel = HasLifecycle(Parallel, {
        lifecycle
    });
    const instance = await RunnableParallel.run(Parallel, env, {});
    expect(instance).toMatchObject({
        four: 4,
        five: 5,
        six: 6
    });
    expect(Parallel.prototype.nowConfigure).toHaveBeenCalledTimes(1);
});

test('run() exhausts parallel queue before proceeding to non-parallel step', async () => {
    const lifecycle = ['seven', 'eight', 'nine']
        .map((x, i) => ({
            name: x,
            parallel: true,
            run: jest.fn(async (self, cb) => {
                const previous = lifecycle[i - 1];
                const next = lifecycle[i + 1];
                if (previous) {
                    expect(previous.run).toHaveBeenCalled();
                }
                if (next) {
                    expect(next.run).not.toHaveBeenCalled();
                }
                self[x] = await cb();
                if (next && next.name !== 'ten') {
                    expect(next.run).toHaveBeenCalled();
                }
            })
        }))
        .concat([
            {
                name: 'ten',
                parallel: false,
                run: jest.fn(async (self, cb) => {
                    lifecycle
                        .slice(0, 3)
                        .forEach(({ run }) => expect(run).toHaveBeenCalled());
                    self.ten = await cb();
                })
            }
        ]);
    function Mixed() {}
    Object.assign(Mixed.prototype, {
        nowConfigure: jest.fn(async () => {
            lifecycle.forEach(({ run }) => expect(run).not.toHaveBeenCalled());
        }),
        nowSeven: () => 7,
        nowEight: () => 8,
        nowNine: () => 9,
        nowTen: () => 10
    });
    const RunnableMixed = HasLifecycle(Mixed, {
        lifecycle
    });
    await RunnableMixed.run(Mixed, env, {});
});
