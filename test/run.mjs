// Runs the database and Wi-Fi sync tests in Node, with phone-only modules swapped
// for small stand-ins (Node's own SQLite and TCP sockets). Usage: npm test
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'clink-test-')), 'sync.test.mjs');
await build({
  entryPoints: ['test/sync.test.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'warning',
  loader: { '.wav': 'empty' },
  alias: {
    'expo-crypto': './test/shims/expo-crypto.ts',
    'expo-network': './test/shims/expo-network.ts',
    'react-native-tcp-socket': './test/shims/tcp.ts',
    'expo-audio': './test/shims/stubs.ts',
    'expo-document-picker': './test/shims/stubs.ts',
    'expo-sharing': './test/shims/stubs.ts',
    'expo-file-system': './test/shims/stubs.ts',
  },
});
execFileSync(process.execPath, ['--no-warnings', out], { stdio: 'inherit' });
