import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal, ModalTitle } from '../components/Modal';
import { decodeBytes } from '../lib/csv';
import { parseSchedule, scheduleTemplate, type ParsedSchedule, type ImportCounts } from '../lib/scheduleImport';

function teamCount(g: ParsedSchedule['groups'][number]): number {
  const set = new Set<string>();
  g.fixtures.forEach((f) => { set.add(f.homeName.toLowerCase()); set.add(f.awayName.toLowerCase()); });
  return set.size;
}

export function ImportModal() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportCounts | null>(null);

  const runParse = (raw: string, name: string) => {
    setText(raw); setFileName(name); setResult(null); setError('');
    try {
      const p = parseSchedule(raw, s.settings.clubName);
      setParsed(p);
      if (p.total === 0) setError('Keine gültigen Begegnungen erkannt. Stimmt das Format?');
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    runParse(decodeBytes(buf), file.name);
  };

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + scheduleTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'spielplan-vorlage.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    if (!parsed) return;
    setResult(s.importSchedule(parsed));
  };

  const close = () => s.closeImport();

  const btn = (label: string, onClick: () => void, primary = false): React.ReactNode => (
    <button onClick={onClick} className="dh-btn" style={{
      background: primary ? 'var(--accent)' : 'var(--btn)', border: primary ? 'none' : '1px solid var(--border-2)',
      color: primary ? 'var(--accent-fg)' : 'var(--text)', padding: '11px 18px', borderRadius: 11,
      fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  );

  return (
    <Modal onClose={close} width={620} z={64} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>Spielplan importieren</ModalTitle>

      {result ? (
        // ── Ergebnis ──
        <>
          <div style={{ background: 'rgba(25,164,99,.1)', border: '1px solid rgba(25,164,99,.4)', borderRadius: 14, padding: 20, marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--success)' }}>Import abgeschlossen</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px', fontSize: 14 }}>
              <Stat label="Ligen neu" value={result.leaguesNew} />
              <Stat label="Ligen ergänzt" value={result.leaguesExisting} />
              <Stat label="Mannschaften (Liga)" value={result.teamsNew} />
              <Stat label="Eigene Mannschaften" value={result.ownTeamsNew} />
              <Stat label="Begegnungen neu" value={result.fixturesNew} />
              <Stat label="Ergebnisse gesetzt" value={result.resultsSet} />
              <Stat label="Termine neu" value={result.eventsNew} />
              <Stat label="Übersprungen" value={result.skipped} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{btn('Fertig', close, true)}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
            CSV deines Verbands (z. B. BDV-Vereinsspielplan) oder die Vorlage hochladen. Es entsteht
            eine Liga je Staffel; eure Mannschaften werden automatisch markiert und eure Begegnungen
            zusätzlich als Termine im Kalender angelegt. Erneuter Import aktualisiert nur Ergebnisse —
            nichts wird doppelt angelegt.
          </div>

          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {btn('Datei wählen', () => fileRef.current?.click())}
            {btn(paste ? 'Einfügen schließen' : 'Text einfügen', () => setPaste((v) => !v))}
            {btn('Vorlage herunterladen', downloadTemplate)}
          </div>

          {paste && (
            <textarea
              value={text}
              onChange={(e) => runParse(e.target.value, 'Eingefügt')}
              placeholder="CSV-Inhalt hier einfügen…"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical', marginBottom: 16,
                background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: 12,
                color: 'var(--text)', fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
              }}
            />
          )}

          {fileName && !paste && (
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Datei: <strong style={{ color: 'var(--text-2)' }}>{fileName}</strong></div>
          )}

          {error && (
            <div style={{ background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', borderRadius: 11, padding: 14, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}

          {parsed && parsed.total > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, marginBottom: 14 }}>
                <span><strong style={{ color: 'var(--text)' }}>{parsed.total}</strong> <span style={{ color: 'var(--text-4)' }}>Begegnungen</span></span>
                <span><strong style={{ color: 'var(--text)' }}>{parsed.groups.length}</strong> <span style={{ color: 'var(--text-4)' }}>Ligen/Staffeln</span></span>
                {parsed.skipped > 0 && <span style={{ color: 'var(--text-4)' }}>{parsed.skipped} übersprungen</span>}
                {parsed.ownClubName && <span style={{ color: 'var(--success)', fontWeight: 700 }}>Eigener Verein: {parsed.ownClubName}</span>}
              </div>

              <div style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, maxHeight: 240, overflow: 'auto', marginBottom: 18 }}>
                {parsed.groups.map((g, i) => {
                  const played = g.fixtures.filter((f) => f.played).length;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < parsed.groups.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Saison {g.season}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right', flexShrink: 0 }}>
                        {teamCount(g)} Mannsch. · {g.fixtures.length} Beg. · {played} Erg.
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-5)', lineHeight: 1.5, marginBottom: 16 }}>
                Hinweis: Der Export enthält nur eure Begegnungen — die Tabellen je Staffel zeigen daher
                eine Vereins-Sicht, keine vollständige Ligatabelle.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                {btn('Abbrechen', close)}
                {btn(`${parsed.total} Begegnungen importieren`, doImport, true)}
              </div>
            </>
          )}

          {!parsed && !error && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{btn('Abbrechen', close)}</div>
          )}
        </>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--text-4)' }}>{label}</span>
      <strong style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace" }}>{value}</strong>
    </div>
  );
}
