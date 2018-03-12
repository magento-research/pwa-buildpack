const debug = require('../util/debug').here(__filename);
module.exports = function createProvisionerRunner(BaseCls, spec) {
    const steps = spec.lifecycle.map(step =>
        Object.assign(
            {
                methodName: `now${step.name
                    .charAt(0)
                    .toUpperCase()}${step.name.slice(1)}`
            },
            step
        )
    );
    const requiredBaseMethods = ['nowConfigure'];
    const validate = instance => {
        const customValidates = spec.validate && spec.validate(instance);
        if (customValidates === true) {
            return;
        }
        const missingMethods = steps
            .map(({ methodName }) => methodName)
            .concat(requiredBaseMethods)
            .filter(methodName => typeof instance[methodName] !== 'function');
        if (missingMethods.length > 0) {
            throw Error(
                debug.errorMsg(
                    `${instance.constructor.name} is an invalid ${
                        spec.name
                    } provisioner. It is missing required methods: ${missingMethods.join()}`
                )
            );
        }
    };
    return class extends BaseCls {
        static numSteps = steps.length;

        static async run(Provisioner, env, config) {
            debug(`new ${Provisioner.name}`);
            const dbg = debug.sub(Provisioner.name);
            const provisioner = new Provisioner();
            validate(provisioner);
            const emitPhaseEvent = (phase, args, result) =>
                env.emit('lifecycle', {
                    phase,
                    args,
                    result,
                    type: spec.name,
                    source: provisioner
                });
            function runWrapped(name, methodName, run) {
                return async () => {
                    dbg(`lifecycle: ${name}`, config);
                    emitPhaseEvent(`before-${name}`);
                    await run(provisioner, async (...args) => {
                        emitPhaseEvent(name, args);
                        dbg(`#${methodName}`, args);
                        const result = await provisioner[methodName](...args);
                        emitPhaseEvent(`after-${name}`, args, result);
                        return result;
                    });
                };
            }
            await runWrapped('configure', 'nowConfigure', async (self, cb) => {
                self.config = await cb(config);
            })();
            let sequence = Promise.resolve();
            let simultaneous = [];
            const batchParallel = () => {
                const batch = simultaneous.slice();
                simultaneous = [];
                sequence = sequence.then(() => {
                    dbg(
                        `: waiting for ${batch.length} parallel tasks complete`
                    );
                    return Promise.all(
                        batch.map(([taskName, task]) => {
                            dbg(`: running ${taskName} in parallel`);
                            return task();
                        })
                    );
                });
            };
            for (const { name, methodName, parallel, run } of steps) {
                const wrapped = runWrapped(name, methodName, run);
                if (parallel) {
                    dbg(`: queuing '${name}' to run in parallel`);
                    simultaneous.push([name, wrapped]);
                } else if (simultaneous.length > 0) {
                    batchParallel();
                } else {
                    dbg(`: running ${name} in sequence`);
                    sequence = sequence.then(wrapped);
                }
            }
            // cleanup
            if (simultaneous.length > 0) {
                batchParallel();
            }
            await sequence;
            dbg(`: complete!`, provisioner);
            return provisioner;
        }
    };
};
