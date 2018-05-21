/**
 * Run sandboxed JavaScript as an administrator.
 * @module run-as-root
 */

const debug = require('./debug').makeFileLogger(__filename);
const path = require('path');
const fs = require('./promisified/fs');
const { exec } = require('./promisified/child_process');
const GlobalConfig = require('./global-config');
const sudoPrompt = require('sudo-prompt');
const { join } = require('path');

const identity = x => x;
let FALLBACK_TIMEOUT = 10;

class ChildProcessOutputError extends Error {
    constructor({ error, stdout, stderr }) {
        // Display all non-empty values without a bunch of extra newlines.
        const message = [error.message || error, stderr, stdout]
            .filter(identity)
            .join('\n\n');

        // Calling parent constructor of base Error class.
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);

        this.errno = error.errno;
        this.code = error.code;
        this.stderr = stderr;
        this.stdout = stdout;
    }
}

class PromiseTimeoutError extends Error {
    constructor({ message, seconds, promise }) {
        // Calling parent constructor of base Error class.
        super(message + ` (Timeout of ${seconds} seconds exceeded.)`);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);

        this.errno = 'ETIMEDOUT';
        this.code = 'ETIMEDOUT';
        this.seconds = seconds;
        this.promise = promise;
    }
}

const tmp = () =>
    join(
        __dirname,
        'tmp' +
            Math.random()
                .toString(20)
                .slice(2)
    );

const opts = {
    name: 'Magento PWA Studio',
    icns: path.join(__dirname, '../../buildpack-logo.icns')
};

const promptingPreferences = new GlobalConfig({
    prefix: 'prompting'
});

function timeoutReject(promise, seconds, message) {
    let settled = false;
    debug('timeoutReject: creating promise race');
    return Promise.race([
        promise.then(
            value => {
                debug(
                    'timeoutReject: original promise resolved, setting settled bit',
                    value
                );
                settled = true;
                return value;
            },
            e => {
                debug(
                    'timeoutReject: original promise rejected, setting settled bit',
                    e
                );
                settled = true;
                throw e;
            }
        ),
        new Promise((resolve, reject) => {
            debug('timeoutReject: entered impl for timeout promise');
            setTimeout(() => {
                debug('timeoutReject: setTimeout activating!');
                if (settled) {
                    resolve();
                } else {
                    reject(
                        new PromiseTimeoutError({ message, seconds, promise })
                    );
                }
            }, seconds * 1000);
        })
    ]);
}

const prompts = {
    async gui(cmd) {
        debug(`creating promise wrapper for sudo-prompt("${cmd}") now...`);
        return new Promise((resolve, reject) => {
            debug(`running sudo-prompt("${cmd}") now...`);
            sudoPrompt.exec(cmd, opts, (error, stdout, stderr) => {
                const output = { error, stdout, stderr };
                debug(`sudo-prompt ${cmd} returned`, output);
                if (output.error) {
                    return reject(new ChildProcessOutputError(output));
                }
                return resolve(output.stdout);
            });
        });
    },
    async cli(cmd) {
        debug(`running ${cmd} in shell...`);
        return exec(cmd).then(
            ({ stdout }) => stdout,
            error => {
                const { stdout, stderr } = error;
                throw new ChildProcessOutputError({ error, stdout, stderr });
            }
        );
    }
};

function fallback({
    firstChoice,
    secondChoice,
    onFallback,
    onFallbackSuccess
}) {
    return async (...args) => {
        let output;
        try {
            const firstTry = firstChoice(...args);
            output = await timeoutReject(firstTry, FALLBACK_TIMEOUT);
        } catch (e) {
            if (
                e.code !== 'ETIMEDOUT' ||
                e.message === 'User did not grant permission'
            ) {
                throw e;
            } else {
                await onFallback();
                output = await secondChoice(...args);
                await onFallbackSuccess();
            }
        }
        return output;
    };
}

const guiToCliFallback = fallback({
    firstChoice: prompts.gui,
    secondChoice: cmd => prompts.cli(`sudo ${cmd}`),
    onFallback: () => {
        console.warn(
            `${FALLBACK_TIMEOUT} seconds have elapsed. If you still cannot see an OS-level prompt, you can enter your password here in the terminal instead.`
        );
    },
    onFallbackSuccess: () => {
        console.log(
            'Your preference for CLI prompting will be recorded. Buildpack will no longer attempt graphical dialogs on your system.'
        );
        return promptingPreferences.set('prefer', 'cli');
    }
});

const sudoPromptToRunShell = async cmd => {
    if (!process.stdout.isTTY && !process.env.BUILDPACK_FORCE_TTY) {
        console.log(
            'Buildpack did not detect a terminal interface. Non-interactive mode: Attempting to run without privilege escalation.'
        );
        console.log(
            'To override TTY detection and force a sudo prompt, set the environment variable BUILDPACK_FORCE_TTY.'
        );
        return prompts.cli(cmd);
    }
    debug(`Detecting fallback preferences...`);
    const prefer = await promptingPreferences.get('prefer');
    if (prefer === 'cli') {
        return prompts.cli(`sudo ${cmd}`);
    } else {
        return guiToCliFallback(cmd);
    }
};

/**
 * Prompts the user for an admin password, then runs its callback with
 * administrative privileges.
 *
 * Node should run as an unprivileged user most of the time, but while setting
 * up a workspace and doing system configuration, we might need root access to
 * do one or two things. Normally, you'd do that by creating a different script
 * file with the privileged code, and then create a child Node process under
 * sudo to run that script file:
 *
 *     child_process.exec('sudo node ./different/script/file', callback)
 *
 * This prompts the user for a Sudo password in any TTY attached to the Node
 * process, and waits to run `callback` until the user has authorized or not.
 *
 * This function automates that process.
 *
 * 1. Stringifies its callback and saves it to a temp file
 * 2. Uses OS native auth dialogs (with CLI fallback) to ask for credentials
 * 3. Runs the temp file with administrative privileges
 * 4. Returns a Promise that fulfills for the stdout of the script.
 *
 * **Warning:** The callback will run in a different process, and will not be
 * able to access any values in enclosed scope. If the function needs a value
 * from the current environment, pass it in through the `args` array and receive
 * it as a parameter.
 *
 * @param {Function|string} fn JavaScript code to run. Must be a function or a
 *     string that evaluates to a function. It can take arguments, which must be
 *     passed in order in an array to the following `args` parameter.
 * @param {Array} args An array of values to be passed as arguments. Must be
 *     serializable to JSON.
 * @returns {Promise<string>} A promise for the standard output of the
 *     evaluated code. Rejects if the user did not authorize, or if the code
 *     threw an exception.
 */
async function runAsRoot(fn, ...args) {
    const impl = fn.toString();
    const scriptLoc = tmp();
    const invoked = `(${impl})(...${JSON.stringify(args)})`;
    await fs.writeFile(scriptLoc, invoked, 'utf8');
    if (process.env.NODE_ENV === 'development') {
        console.log(
            'Administrative credentials required. Your OS should prompt you to enter your password securely.'
        );
    }
    debug(`elevating privileges for ${impl}`);
    try {
        return await sudoPromptToRunShell(`${process.argv[0]} ${scriptLoc}`);
    } finally {
        await fs.unlink(scriptLoc);
    }
}

runAsRoot.setFallbackTimeout = newTimeout => {
    FALLBACK_TIMEOUT = newTimeout;
};

module.exports = runAsRoot;
