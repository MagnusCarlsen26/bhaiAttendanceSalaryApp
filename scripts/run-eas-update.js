const { spawnSync } = require('child_process');

const branch = process.argv[2];
const message = process.env.EAS_UPDATE_MESSAGE;

if (!branch) {
  console.error('Usage: node scripts/run-eas-update.js <branch>');
  process.exit(1);
}

if (!message) {
  console.error('EAS_UPDATE_MESSAGE is required.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['eas-cli@latest', 'update', '--branch', branch, '--message', message, '--non-interactive'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
