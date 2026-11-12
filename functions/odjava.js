import { clearCookie, redirect } from '../lib/sarajka.js';
export const onRequestGet = () => redirect('/prijava?odjava=1', { 'Set-Cookie': clearCookie });
