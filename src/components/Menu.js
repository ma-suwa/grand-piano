'use client';

import { useState } from 'react';
import Icon from './Icon';
import RecordingsPanel from './RecordingsPanel';
import HelpView from './HelpView';
import OptionsView from './OptionsView';
import { useT } from '@/lib/i18n';
import styles from './Menu.module.css';

const TITLES = { recordings: 'menu.recordings', help: 'menu.help', options: 'menu.options' };

// ≡ ボタンで開くメニュー。画面の右から出てくる。
// 項目: 録音した音源 / 使い方 / オプション
export default function Menu({ unheard, recordingsProps, settings, onSettingsChange, tempoLocked, onClose, initialPage = 'root' }) {
    const [page, setPage] = useState(initialPage);
    const t = useT();

    return (
        <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.sheet} role="dialog" aria-label={t('menu')}>
                <div className={styles.head}>
                    {page !== 'root' ? (
                        <button type="button" className={styles.back} onClick={() => setPage('root')} aria-label={t('menu.back')}>
                            <Icon name="chevron-left" size={24} />
                        </button>
                    ) : (
                        <span className={styles.backSpace} />
                    )}
                    <span className={styles.title}>{t(TITLES[page] || 'menu')}</span>
                    <button type="button" className={styles.close} onClick={onClose} aria-label={t('menu.close')}>
                        <Icon name="x" size={22} />
                    </button>
                </div>
                <div className={styles.body}>
                    {page === 'root' && (
                        <ul className={styles.items}>
                            <li>
                                <button type="button" className={styles.item} onClick={() => setPage('recordings')}>
                                    <Icon name="mic" size={20} className={styles.itemIcon} />
                                    <span className={styles.itemLabel}>{t('menu.recordings')}</span>
                                    {unheard > 0 && (
                                        <span className={styles.badge} aria-label={t('menu.unheard', unheard)}>
                                            {unheard}
                                        </span>
                                    )}
                                    <Icon name="chevron-right" size={18} className={styles.chevron} />
                                </button>
                            </li>
                            <li>
                                <button type="button" className={styles.item} onClick={() => setPage('help')}>
                                    <Icon name="circle-help" size={20} className={styles.itemIcon} />
                                    <span className={styles.itemLabel}>{t('menu.help')}</span>
                                    <Icon name="chevron-right" size={18} className={styles.chevron} />
                                </button>
                            </li>
                            <li>
                                <button type="button" className={styles.item} onClick={() => setPage('options')}>
                                    <Icon name="settings" size={20} className={styles.itemIcon} />
                                    <span className={styles.itemLabel}>{t('menu.options')}</span>
                                    <Icon name="chevron-right" size={18} className={styles.chevron} />
                                </button>
                            </li>
                        </ul>
                    )}
                    {page === 'recordings' && <RecordingsPanel {...recordingsProps} />}
                    {page === 'help' && <HelpView />}
                    {page === 'options' && <OptionsView settings={settings} onChange={onSettingsChange} tempoLocked={tempoLocked} />}
                </div>
            </div>
        </div>
    );
}
