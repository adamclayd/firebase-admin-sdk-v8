import * as fs from 'fs';

export function isEmulatorRunning(emulator: 'auth' | 'firestore' | 'storage') {
    return process.env[`${emulator.toUpperCase()}_EMULATOR_RUNNING`] === 'true';
}

export function getEmulatorHost(emulator: 'auth' | 'firestore' | 'storage') {
    return `127.0.0.1:${JSON.parse(fs.readFileSync('firebase.json', 'utf-8')).emulators?.[emulator]?.port}`;
}