// TODO: (p2) test scenario
test('extends BuildSession and supports modes and provisioners');

test(
    'constructs with env, frontend, backend, assembles its properties from them'
);

test('async connect() checks for symlinks of theme into M2 dir');

test('async connect() handles and filters errors in lstat method');

test('async connect() errors if a non-symlink exists in expected symlink path');

test('async connect() removes symlinks in target path');

test('async connect() checks frontend viewconfig for serviceworker');

test('async connect() creates a devServer and resolver');

test('async connect() formats and writes writes devserver values');

test('envToVars extends base hash with SERVICE_WORKER_FILE_NAME');

test(
    'envToVars sets SERVICE_WORKER_DISABLED_IN_DEV if there is no enableServiceWorkerDebugging option'
);
