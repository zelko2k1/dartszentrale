import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoScreen } from './app';
import { loginVerein } from './verein';
import {
  loginBoard, readPairCode, pairRemote,
  openDeviceSettings, enableWatch, disableWatch, openRemote,
} from './live';

// Fernbedienung und Zuschauer-TV — die beiden login-freien Flächen.
//
// Sie brauchen echte Server-Zustände: eine laufende Live-Session (nur ein Board-Konto im
// Kiosk-Modus veröffentlicht eine) und den eingeschalteten öffentlichen Kanal. Deshalb laufen
// diese Prüfungen NACHEINANDER — sie teilen sich denselben Serverzustand.
//
// ⚠ Der Zuschauer-Kanal ist der einzige Schreibvorgang der gesamten Prüfung; er wird am Ende
// wieder ausgeschaltet.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(WCAG).analyze();

function summarize(violations: Awaited<ReturnType<typeof scan>>['violations']): string {
  return violations.map((v) => {
    const where = v.nodes.slice(0, 4).map((n) => {
      const why = [...n.any, ...n.all].map((c) => c.message).filter(Boolean)[0] ?? '';
      return `${n.target.join(' ')}\n           ${n.html.replace(/\s+/g, ' ').slice(0, 120)}\n           → ${why.replace(/\s+/g, ' ').slice(0, 160)}`;
    }).join('\n        ');
    const more = v.nodes.length > 4 ? `\n        … und ${v.nodes.length - 4} weitere` : '';
    return `  [${v.impact ?? '?'}] ${v.id}: ${v.help}\n     ${v.nodes.length} Stelle(n):\n        ${where}${more}`;
  }).join('\n');
}

async function expectClean(page: import('@playwright/test').Page) {
  const { violations } = await scan(page);
  expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);
}

test.describe.configure({ mode: 'serial' });

test.describe('Live-Flächen', () => {
  test('Board im Kiosk-Modus veröffentlicht eine Session', async ({ page }) => {
    await loginBoard(page);
    await expectClean(page);
  });

  test('Fernbedienung: koppeln und Konsole bedienen', async ({ page, browser }) => {
    await loginBoard(page);
    const code = await readPairCode(page);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    // Das Handy ist ein EIGENES Gerät: eigener Kontext, eigener localStorage — sonst erbt es
    // die Board-Anmeldung und die Kopplung würde gar nicht erst geprüft.
    const phoneCtx = await browser.newContext();
    const phone = await phoneCtx.newPage();
    await phone.setViewportSize({ width: 412, height: 915 });
    // Anmelden und die Code-Eingabe öffnen — sie ist selbst schon eine zu prüfende Fläche.
    await openRemote(phone);
    await expectClean(phone);
    // Gekoppelte Konsole: Zifferntasten, Schnellwerte, Eingabezeile.
    await pairRemote(phone, code);
    await expectClean(phone);
    await phoneCtx.close();
  });

  test('Zuschauer-TV: Auswahlliste ohne Anmeldung', async ({ browser }) => {
    // Board, Admin und Zuschauer sind DREI Geräte — jedes braucht seinen eigenen Kontext.
    // Im selben Kontext teilen sie sich localStorage und damit die Anmeldung; das Board wäre
    // dann auch als Admin angemeldet und der Anmeldebildschirm erschiene nie.
    const boardCtx = await browser.newContext();
    const board = await boardCtx.newPage();
    await loginBoard(board);
    await readPairCode(board); // wartet, bis die Session wirklich angemeldet ist

    const adminCtx = await browser.newContext();
    const page = await adminCtx.newPage();
    await loginVerein(page);
    await gotoScreen(page, 'Einstellungen');
    await openDeviceSettings(page);
    const link = await enableWatch(page);
    expect(link).toMatch(/#\/watch\//);

    const tvCtx = await browser.newContext();
    const tv = await tvCtx.newPage();
    await tv.goto(link.replace(/^https?:\/\/[^/]+/, ''));
    // Entweder läuft ein Spiel (Auswahlliste) oder es wird gewartet — beides ist eine Fläche.
    await tv.getByText(/Spiel wählen|Warten auf das nächste Spiel/).first().waitFor({ timeout: 20_000 });
    await expectClean(tv);

    // Zustand zurückgeben: der Kanal war vorher aus.
    await disableWatch(page);
    await tvCtx.close();
    await boardCtx.close();
    await adminCtx.close();
  });
});
