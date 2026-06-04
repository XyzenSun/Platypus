import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

export default function setup(): void {
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
}
