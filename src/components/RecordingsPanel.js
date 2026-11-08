'use client';

import { useState } from 'react';
import { formatDate, formatDuration } from '../lib/recordings';
import { errorText, useT } from '../lib/i18n';
import Icon from './Icon';
import styles from './RecordingsPanel.module.css';

// 録音した音源の一覧(メニューの中に表示する)。
// まだ聴いていない録音には赤い丸をつける。再生/停止・名前の変更・共有(MP3 / MIDI)・削除ができる
export default function RecordingsPanel({ recordings, playingId, onPlay, onStop, onChange, onShare }) {
    const t = useT();
    const [shareId, setShareId] = useState(null); // 共有の選択肢を開いている録音
    const [busy, setBusy] = useState(null); // { id, format, progress } ファイルを作っている間
    const share = async (rec, format) => {
        if (busy) return;
        setBusy({ id: rec.id, format, progress: 0 });
        try {
            await onShare(rec, format, (progress) => setBusy((b) => (b ? { ...b, progress } : b)));
            setShareId(null);
        } catch (err) {
            const detail = errorText(t, err);
            window.alert(`${t('recs.shareFailed')}${detail ? `\n${detail}` : ''}`);
        } finally {
            setBusy(null);
        }
    };
    const rename = (rec) => {
        const name = window.prompt(t('recs.renamePrompt'), rec.name);
        if (name === null || !name.trim()) return;
        onChange(recordings.map((r) => (r.id === rec.id ? { ...r, name: name.trim() } : r)));
    };
    const remove = (rec) => {
        if (!window.confirm(t('recs.deleteConfirm', rec.name))) return;
        if (playingId === rec.id) onStop();
        onChange(recordings.filter((r) => r.id !== rec.id));
    };

    if (recordings.length === 0) {
        return <p className={styles.empty}>{t('recs.empty')}</p>;
    }

    return (
        <ul className={styles.list}>
            {recordings.map((rec) => {
                const playing = playingId === rec.id;
                return (
                    <li key={rec.id} className={`${styles.item} ${playing ? styles.playing : ''}`}>
                        <button
                            type="button"
                            className={styles.play}
                            onClick={() => (playing ? onStop() : onPlay(rec))}
                            aria-label={playing ? t('recs.stop') : t('recs.play')}
                        >
                            {playing ? (
                                <Icon name="square" size={14} fill="currentColor" />
                            ) : (
                                <Icon name="play" size={16} fill="currentColor" className={styles.playIcon} />
                            )}
                        </button>
                        <button type="button" className={styles.info} onClick={() => rename(rec)}>
                            <span className={styles.name}>
                                {rec.unheard && <span className={styles.unheard} aria-label={t('recs.unheard')} />}
                                <span className={styles.nameText}>{rec.name}</span>
                            </span>
                            <span className={styles.meta}>
                                {formatDate(rec.createdAt)} · {formatDuration(rec.duration)}
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${shareId === rec.id ? styles.iconOn : ''}`}
                            onClick={() => setShareId(shareId === rec.id ? null : rec.id)}
                            aria-label={t('recs.share')}
                            aria-expanded={shareId === rec.id}
                        >
                            <Icon name="share" size={18} />
                        </button>
                        <button type="button" className={styles.delete} onClick={() => remove(rec)} aria-label={t('recs.delete')}>
                            <Icon name="trash-2" size={18} />
                        </button>
                        {shareId === rec.id && (
                            <div className={styles.share}>
                                {busy?.id === rec.id ? (
                                    <span className={styles.busy}>
                                        {busy.format === 'mp3'
                                            ? t('recs.makingMp3', Math.round((busy.progress || 0) * 100))
                                            : t('recs.makingMidi')}
                                    </span>
                                ) : (
                                    <>
                                        <span className={styles.shareLabel}>{t('recs.format')}</span>
                                        <button type="button" className={styles.format} onClick={() => share(rec, 'mp3')}>
                                            MP3
                                            <small>{t('recs.mp3Note')}</small>
                                        </button>
                                        <button type="button" className={styles.format} onClick={() => share(rec, 'midi')}>
                                            MIDI
                                            <small>{t('recs.midiNote')}</small>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
