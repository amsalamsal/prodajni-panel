// Javna stranica za klijente: /?p=stanovi (linkovi i QR kodovi vode ovdje)
import { renderApp } from '../lib/sarajka.js';
export const onRequestGet = context => renderApp(context, 'client');
