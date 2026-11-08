'use client';

import { TEMPO_MAX, TEMPO_MIN } from '@/lib/metronome';
import { useT } from '@/lib/i18n';
import styles from './MetronomePanel.module.css';

// メトロノームのボタンを長押ししたときに出る、テンポと拍子の調整
// locked: ループ中はテンポと拍子を変えられない(ループの長さがずれるため)
export default function MetronomePanel({ tempo, beats, locked, onChange, onClose }) {
    const t = useT();
    const setTempo = (v) => onChange({ tempo: Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, v)) });
    return (
        <>
            {/* パネルの外を押したら閉じる */}
            <div className={styles.backdrop} onPointerDown={onClose} />
            <div className={styles.panel} role="dialog" aria-label={t('metro.settings')}>
                <div className={styles.tempoRow}>
                    <button
                        type="button"
                        className={styles.step}
                        onClick={() => setTempo(tempo - 1)}
                        disabled={locked}
                        aria-label={t('metro.slower')}
                    >
                        −
                    </button>
                    <div className={styles.tempo}>
                        <span className={styles.tempoValue}>{tempo}</span>
                        <span className={styles.tempoUnit}>BPM</span>
                    </div>
                    <button
                        type="button"
                        className={styles.step}
                        onClick={() => setTempo(tempo + 1)}
                        disabled={locked}
                        aria-label={t('metro.faster')}
                    >
                        +
                    </button>
                </div>
                <input
                    type="range"
                    min={TEMPO_MIN}
                    max={TEMPO_MAX}
                    step="1"
                    value={tempo}
                    disabled={locked}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className={styles.slider}
                    aria-label={t('metro.tempo')}
                />
                <div className={styles.segment}>
                    {[
                        [3, t('metro.beats3')],
                        [4, t('metro.beats4')],
                    ].map(([v, label]) => (
                        <button
                            key={v}
                            type="button"
                            disabled={locked}
                            className={`${styles.segmentButton} ${beats === v ? styles.selected : ''}`}
                            onClick={() => onChange({ beats: v })}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {locked && <p className={styles.note}>{t('metro.locked')}</p>}
            </div>
        </>
    );
}
