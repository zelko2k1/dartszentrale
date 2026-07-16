import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal, ModalTitle } from '../components/Modal';
import { decodeBytes, countReplacementChars } from '../lib/csv';
import { parseSchedule, scheduleTemplate, describeImportSeason, type ParsedSchedule, type ImportCounts } from '../lib/scheduleImport';
import { useT } from '../i18n';

function teamCount(g: ParsedSchedule['groups'][number]): number {
  const set = new Set<string>();
  g.fixtures.forEach((f) => { set.add(f.homeName.toLowerCase()); set.add(f.awayName.toLowerCase()); });
  return set.size;
}

export function ImportModal() {
  const s = useStore();
  const tr = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [result, setResult] = useState<ImportCounts | null>(null);

  const runParse = (raw: string, name: string) => {
    setText(raw); setFileName(name); setResult(null); setError('');
    const bad = countReplacementChars(raw);
    setWarning(bad > 0 ? tr.modals.badChars(bad) : '');
    try {
      const p = parseSchedule(raw, s.settings.clubName);
      setParsed(p);
      if (p.total === 0) setError(tr.modals.noValidFixtures);
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : tr.modals.fileUnreadable);
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
      <ModalTitle>{tr.modals.importTitle}</ModalTitle>

      {result ? (
        // ── Ergebnis ──
        <>
          <div style={{ background: 'rgba(25,164,99,.1)', border: '1px solid rgba(25,164,99,.4)', borderRadius: 14, padding: 20, marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--success)' }}>{tr.modals.importDone}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px', fontSize: 14 }}>
              <Stat label={tr.modals.statLeaguesNew} value={result.leaguesNew} />
              <Stat label={tr.modals.statLeaguesExisting} value={result.leaguesExisting} />
              <Stat label={tr.modals.statTeamsLeague} value={result.teamsNew} />
              <Stat label={tr.modals.statOwnTeams} value={result.ownTeamsNew} />
              <Stat label={tr.modals.statFixturesNew} value={result.fixturesNew} />
              <Stat label={tr.modals.statResultsSet} value={result.resultsSet} />
              <Stat label={tr.modals.statEventsNew} value={result.eventsNew} />
              <Stat label={tr.modals.statSkipped} value={result.skipped} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{btn(tr.modals.done, close, true)}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
            {tr.modals.importIntro}
          </div>

          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {btn(tr.modals.chooseFile, () => fileRef.current?.click())}
            {btn(paste ? tr.modals.pasteClose : tr.modals.pasteText, () => setPaste((v) => !v))}
            {btn(tr.modals.downloadTemplate, downloadTemplate)}
          </div>

          {paste && (
            <textarea
              value={text}
              onChange={(e) => runParse(e.target.value, tr.modals.pastedName)}
              placeholder={tr.modals.pastePh}
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical', marginBottom: 16,
                background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: 12,
                color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-num)',
              }}
            />
          )}

          {fileName && !paste && (
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>{tr.modals.fileLabel}<strong style={{ color: 'var(--text-2)' }}>{fileName}</strong></div>
          )}

          {error && (
            <div style={{ background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', borderRadius: 11, padding: 14, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}

          {warning && (
            <div style={{ background: 'rgba(224,168,75,.12)', border: '1px solid rgba(224,168,75,.45)', color: '#C9882E', borderRadius: 11, padding: 14, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>⚠️ {warning}</div>
          )}

          {parsed && parsed.total > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, marginBottom: 14 }}>
                <span><strong style={{ color: 'var(--text)' }}>{parsed.total}</strong> <span style={{ color: 'var(--text-4)' }}>{tr.modals.fixturesWord}</span></span>
                <span><strong style={{ color: 'var(--text)' }}>{parsed.groups.length}</strong> <span style={{ color: 'var(--text-4)' }}>{tr.modals.groupsWord}</span></span>
                {parsed.skipped > 0 && <span style={{ color: 'var(--text-4)' }}>{tr.modals.skippedWord(parsed.skipped)}</span>}
                {parsed.ownClubName && <span style={{ color: 'var(--success)', fontWeight: 700 }}>{tr.modals.ownClub}{parsed.ownClubName}</span>}
              </div>

              {(() => {
                const si = describeImportSeason(parsed.groups, s.seasons, s.activeSeasonId);
                if (si.willSwitchActive) {
                  // Achtung: Import wechselt die aktive Saison → alte wird archiviert.
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(242,184,41,.12)', border: '1px solid rgba(242,184,41,.45)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9882E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                      <span>
                        {tr.modals.seasonInto}<strong style={{ color: 'var(--text)' }}>{si.targetName}</strong>{si.targetExists ? '' : tr.modals.willCreate}.
                        {' '}<strong style={{ color: '#C9882E' }}>{tr.modals.attention}</strong>{tr.modals.activeSeason1}<strong style={{ color: 'var(--text)' }}>{si.archivedName}</strong>{tr.modals.archived1}<strong>{tr.modals.archivedWord}</strong>{tr.modals.archived2}
                      </span>
                    </div>
                  );
                }
                // Unkritisch: gleiche/aktive Saison oder neue Saison ohne bestehende aktive.
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></svg>
                    <span>{tr.modals.seasonInto2}{si.targetExists ? tr.modals.seasonIntoActive : tr.modals.seasonIntoNew} <strong style={{ color: 'var(--text)' }}>{si.targetName}</strong>{si.targetExists ? '' : tr.modals.willCreateActive}.</span>
                  </div>
                );
              })()}

              <div style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, maxHeight: 240, overflow: 'auto', marginBottom: 18 }}>
                {parsed.groups.map((g, i) => {
                  const played = g.fixtures.filter((f) => f.played).length;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < parsed.groups.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{tr.common.season} {g.season}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right', flexShrink: 0 }}>
                        {teamCount(g)} {tr.modals.teamsAbbrev} · {g.fixtures.length} {tr.modals.fixturesAbbrev} · {played} {tr.modals.resultsAbbrev}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-5)', lineHeight: 1.5, marginBottom: 16 }}>
                {tr.modals.importNote}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                {btn(tr.common.cancel, close)}
                {btn(tr.modals.importN(parsed.total), doImport, true)}
              </div>
            </>
          )}

          {!parsed && !error && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{btn(tr.common.cancel, close)}</div>
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
      <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-num)' }}>{value}</strong>
    </div>
  );
}
