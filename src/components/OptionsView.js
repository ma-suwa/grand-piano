'use client';

import { DEFAULT_SETTINGS } from '@/lib/settings';
import { TEMPO_MAX, TEMPO_MIN } from '@/lib/metronome';
import { useT } from '@/lib/i18n';
import styles from './Menu.module.css';

// いくつかの中から1つを選ぶボタン
function Choice({ value, options, onChange, disabled }) {
    return (
        <div className={styles.segment}>
            {options.map(([v, label]) => (
                <button
                    key={v}
                    type="button"
                    className={`${styles.segmentButton} ${value === v ? styles.selected : ''}`}
                    disabled={disabled}
                    onClick={() => onChange(v)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function Toggle({ value, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            aria-label={label}
            className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
            onClick={() => onChange(!value)}
        >
            <span className={styles.knob} />
        </button>
    );
}

function Row({ title, note, children }) {
    return (
        <div className={styles.option}>
            <div className={styles.optionText}>
                <span className={styles.optionTitle}>{title}</span>
                {note && <span className={styles.optionNote}>{note}</span>}
            </div>
            <div className={styles.optionControl}>{children}</div>
        </div>
    );
}

// 細かい設定。変えるとすぐに音や表示に反映し、端末に保存する
export default function OptionsView({ settings, onChange, tempoLocked }) {
    const t = useT();
    const set = (key) => (value) => onChange({ ...settings, [key]: value });
    // 選択肢: [値, 文言のキー]
    const opts = (prefix, values) => values.map((v) => [v, t(`${prefix}.${v}`)]);
    return (
        <div className={styles.options}>
            <h3 className={styles.groupTitle}>{t('opt.sound')}</h3>
            <Row title={t('opt.volume')} note={`${settings.volume}`}>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={settings.volume}
                    onChange={(e) => set('volume')(Number(e.target.value))}
                    className={styles.slider}
                    aria-label={t('opt.volume')}
                />
            </Row>
            <Row title={t('opt.reverb')} note={t('opt.reverbNote')}>
                <Choice value={settings.reverb} onChange={set('reverb')} options={opts('opt.reverb', ['off', 'low', 'mid', 'high'])} />
            </Row>
            <Row title={t('opt.touch')} note={t('opt.touchNote')}>
                <Choice value={settings.touch} onChange={set('touch')} options={opts('opt.touch', ['soft', 'normal', 'strong'])} />
            </Row>
            <Row title={t('opt.sustain')} note={t('opt.sustainNote')}>
                <Toggle value={settings.sustain} onChange={set('sustain')} label={t('opt.sustain')} />
            </Row>

            <Row title={t('opt.loopVolume')} note={t('opt.loopVolumeNote')}>
                <Choice
                    value={settings.loopVolume}
                    onChange={set('loopVolume')}
                    options={opts('opt.loopVolume', ['low', 'mid', 'same'])}
                />
            </Row>

            <h3 className={styles.groupTitle}>{t('opt.metronome')}</h3>
            <Row title={t('opt.tempo')} note={tempoLocked ? t('opt.tempoLocked', settings.tempo) : `${settings.tempo} BPM`}>
                <input
                    type="range"
                    min={TEMPO_MIN}
                    max={TEMPO_MAX}
                    step="1"
                    value={settings.tempo}
                    disabled={tempoLocked}
                    onChange={(e) => set('tempo')(Number(e.target.value))}
                    className={styles.slider}
                    aria-label={t('opt.tempo')}
                />
            </Row>
            <Row title={t('opt.beats')} note={t('opt.beatsNote')}>
                <Choice
                    value={settings.beats}
                    onChange={set('beats')}
                    disabled={tempoLocked}
                    options={[[3, t('metro.beats3')], [4, t('metro.beats4')]]}
                />
            </Row>

            <h3 className={styles.groupTitle}>{t('opt.display')}</h3>
            <Row title={t('opt.lang')} note={t('opt.langNote')}>
                <Choice
                    value={settings.lang}
                    onChange={set('lang')}
                    options={[['auto', t('opt.lang.auto')], ['ja', '日本語'], ['en', 'English']]}
                />
            </Row>
            <Row title={t('opt.labels')} note={t('opt.labelsNote')}>
                <Choice value={settings.labels} onChange={set('labels')} options={opts('opt.labels', ['none', 'c', 'all'])} />
            </Row>
            <Row title={t('opt.noteStyle')} note={t('opt.noteStyleNote')}>
                <Choice
                    value={settings.noteStyle}
                    onChange={set('noteStyle')}
                    options={[['abc', 'C D E'], ['doremi', t('opt.noteStyle.doremi')]]}
                />
            </Row>
            <Row title={t('opt.pcHints')} note={t('opt.pcHintsNote')}>
                <Toggle value={settings.pcHints} onChange={set('pcHints')} label={t('opt.pcHints')} />
            </Row>

            <button type="button" className={styles.reset} onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
                {t('opt.reset')}
            </button>
        </div>
    );
}
