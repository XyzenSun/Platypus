import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';

export async function loadConfig(envPath?: string): Promise<(name: string) => string | undefined> {
  const fileVariables = envPath ? parse(await readFile(envPath)) : {};
  return (name) => fileVariables[name] ?? process.env[name];
}
