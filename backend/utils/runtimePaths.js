import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.join(__dirname, '..', '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const RUNTIME_DATA_DIR = process.env.RUNTIME_DATA_DIR
  ? path.resolve(process.env.RUNTIME_DATA_DIR)
  : DATA_DIR;

export function dataPath(...segments) {
  return path.join(DATA_DIR, ...segments);
}

export function runtimeDataPath(...segments) {
  return path.join(RUNTIME_DATA_DIR, ...segments);
}

export function runtimeFileOptions(...segments) {
  const filePath = runtimeDataPath(...segments);
  const seedFilePath = dataPath(...segments);

  return {
    filePath,
    seedFilePath: path.resolve(filePath) === path.resolve(seedFilePath) ? null : seedFilePath,
  };
}
