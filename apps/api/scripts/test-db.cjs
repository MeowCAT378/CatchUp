const { execFileSync } = require('node:child_process');

const url = process.env.CATCHUP_TEST_DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) throw new Error('CATCHUP_TEST_DATABASE_URL must point to a database whose name contains "test".');
const command = process.argv[2];
const bin = (name) => process.platform === 'win32' ? `node_modules/.bin/${name}.cmd` : `node_modules/.bin/${name}`;
const run = (name, args) => execFileSync(process.platform === 'win32' ? process.execPath : bin(name), process.platform === 'win32' ? [`node_modules/${name === 'prisma' ? 'prisma/build/index.js' : 'jest/bin/jest.js'}`, ...args] : args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
if (command === 'migrate') run('prisma', ['migrate', 'deploy']);
else if (command === 'test') run('jest', ['--config', './test/jest-e2e.json', '--runInBand']);
else throw new Error('Use migrate or test.');
