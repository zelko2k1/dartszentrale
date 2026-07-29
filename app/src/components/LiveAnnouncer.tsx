import { useEffect, useRef, useState } from 'react';

// Ansage-Bereich für Screenreader.
//
// Die App hatte KEINE einzige Live-Region — in einer Zähl-App heißt das: Restscore, Bust,
// Leg- und Satzgewinn passieren für blinde Nutzer lautlos. Am Board ist genau das die
// Information, auf die es ankommt.
//
// Bewusst EINE Region pro Bildschirm statt vieler verstreuter aria-live-Attribute: mehrere
// gleichzeitig sprechende Regionen übertönen sich gegenseitig. `message` wird vom Aufrufer
// aus dem Spielstand abgeleitet; jede Änderung wird angesagt.
//
// `politeness`:
//   'polite'    – wartet, bis der Screenreader ausgeredet hat (Normalfall: Wurf, Spielerwechsel)
//   'assertive' – unterbricht (nur für Dinge, die den Spielfluss stoppen, z. B. Bust)
export function LiveAnnouncer({ message, politeness = 'polite' }: {
  message: string;
  politeness?: 'polite' | 'assertive';
}) {
  // Zwei abwechselnde Slots: wiederholt sich eine Ansage wortgleich (z. B. zweimal „26 geworfen"),
  // bemerkt der Screenreader eine unveränderte Textnode nicht. Der Wechsel erzwingt die Ansage.
  const [slots, setSlots] = useState<[string, string]>(['', '']);
  const flip = useRef(0);
  const last = useRef('');

  useEffect(() => {
    const text = message.trim();
    if (!text || text === last.current) return;
    last.current = text;
    flip.current = flip.current === 0 ? 1 : 0;
    setSlots(flip.current === 0 ? [text, ''] : ['', text]);
  }, [message]);

  return (
    <div className="dh-sr-only" aria-live={politeness} aria-atomic="true">
      <div>{slots[0]}</div>
      <div>{slots[1]}</div>
    </div>
  );
}
