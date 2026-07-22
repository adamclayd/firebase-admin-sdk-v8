import * as fs from 'fs';

export default async function globalSetup() {
    const AUTH_PORT = fs.existsSync('firebase.json') ? JSON.parse(String.fromCharCode(...new Uint8Array(fs.readFileSync('firebase.json')))).emulators?.auth?.port : undefined;
    const FIRESTORE_PORT = fs.existsSync('firebase.json') ? JSON.parse(String.fromCharCode(...new Uint8Array(fs.readFileSync('firebase.json')))).emulators?.firestore?.port : undefined;
    const STORAGE_PORT = fs.existsSync('firebase.json') ? JSON.parse(String.fromCharCode(...new Uint8Array(fs.readFileSync('firebase.json')))).emulators?.storage?.port : undefined;
    try {
        if(AUTH_PORT) {
            const response = await fetch(`http://127.0.0.1:${AUTH_PORT}/`);

            if(response.ok || response.status === 501)
                process.env.AUTH_EMULATOR_RUNNING = 'true';
        }
    }
    catch {}

    try {
        if(FIRESTORE_PORT) {
            const response = await fetch(`http://127.0.0.1:${FIRESTORE_PORT}/`);

            if(response.ok || response.status === 501)
                process.env.FIRESTORE_EMULATOR_RUNNING = 'true';
        }
    }
    catch {}

    try {
        if(STORAGE_PORT) {
            const response = await fetch(`http://127.0.0.1:${STORAGE_PORT}/`);

            if(response.ok || response.status === 501)
                process.env.STORAGE_EMULATOR_RUNNING = 'true';
        }
    }
    catch {}
}