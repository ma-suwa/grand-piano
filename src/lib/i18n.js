// 画面の文言(日本語 / 英語)。オプションの「言語」で切り替える。
// 'auto' のときは端末の言語が日本語なら日本語、それ以外は英語にする
'use client';

import { createContext, useContext } from 'react';

export const LANGS = ['ja', 'en'];

export const resolveLang = (pref) => {
    if (LANGS.includes(pref)) return pref;
    if (typeof navigator === 'undefined') return 'ja';
    const list = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
    return /^ja\b/i.test(list[0] || '') ? 'ja' : 'en';
};

const ja = {
    // ヘッダー
    'rec.start': '録音する',
    'rec.cancel': '録音をやめる',
    'rec.stop': '録音を止める',
    'metro.start': 'メトロノームを鳴らす',
    'metro.stop': 'メトロノームを止める',
    'loop.idle': 'ループを録音する',
    'loop.countin': 'ループの録音をやめる',
    'loop.recording': 'ループの録音を終える',
    'loop.countdown': 'ループを流すのをやめる',
    'loop.playing': 'ループを止める',
    'loop.paused': 'ループを流す',
    'loop.delete': 'ループを消す',
    'loop.timeline': 'ループのタイムライン',
    'rows.one': '1段にする',
    'rows.two': '2段にする',
    'menu': 'メニュー',
    'status.loading': '音源読込中…',
    'status.synth': '合成音',
    'saveFailed': '録音を保存できませんでした。端末の空き容量が足りない可能性があります。古い録音を削除してからもう一度お試しください。',

    // メニュー
    'menu.back': '戻る',
    'menu.close': '閉じる',
    'menu.recordings': '録音した音源',
    'menu.help': '使い方',
    'menu.options': 'オプション',
    'menu.unheard': (n) => `未確認 ${n}件`,

    // 録音した音源
    'recs.empty': 'まだ録音がありません。画面上の ● ボタンを押すと録音が始まります。',
    'recs.play': '再生',
    'recs.stop': '停止',
    'recs.unheard': '未確認',
    'recs.share': '共有',
    'recs.delete': '削除',
    'recs.renamePrompt': '録音の名前',
    'recs.deleteConfirm': (name) => `「${name}」を削除しますか？`,
    'recs.shareFailed': '共有できませんでした。',
    'recs.format': '共有する形式',
    'recs.mp3Note': '音声',
    'recs.midiNote': '楽譜データ',
    'recs.makingMp3': (p) => `MP3を作っています… ${p}%`,
    'recs.makingMidi': 'MIDIを作っています…',
    'err.mp3TooLong': (min) => `MP3 にできるのは ${min} 分までの録音です。MIDI なら共有できます。`,
    'err.samplesLoading': 'ピアノの音源を読み込み中です。少し待ってからもう一度お試しください。',

    // メトロノーム
    'metro.settings': 'メトロノームの設定',
    'metro.slower': 'テンポを下げる',
    'metro.faster': 'テンポを上げる',
    'metro.tempo': 'テンポ',
    'metro.beats3': '3拍子',
    'metro.beats4': '4拍子',
    'metro.locked': 'ループを流している間は変えられません',

    // オプション
    'opt.sound': '音',
    'opt.volume': '音量',
    'opt.reverb': '響き',
    'opt.reverbNote': 'ホールで弾いたような残響の量',
    'opt.reverb.off': 'なし',
    'opt.reverb.low': '少し',
    'opt.reverb.mid': 'ふつう',
    'opt.reverb.high': '多め',
    'opt.touch': 'タッチの強さ',
    'opt.touchNote': '鍵盤をタップしたときの音の強さ',
    'opt.touch.soft': '弱く',
    'opt.touch.normal': 'ふつう',
    'opt.touch.strong': '強く',
    'opt.sustain': 'ペダル',
    'opt.sustainNote': '指を離しても音が自然に消えるまで鳴り続けます',
    'opt.loopVolume': 'ループの音量',
    'opt.loopVolumeNote': '🔁 でくり返すフレーズの音の大きさ',
    'opt.loopVolume.low': '小さめ',
    'opt.loopVolume.mid': '少し小さめ',
    'opt.loopVolume.same': '同じ',
    'opt.metronome': 'メトロノーム',
    'opt.tempo': 'テンポ',
    'opt.tempoLocked': (bpm) => `${bpm} BPM(ループ中は変えられません)`,
    'opt.beats': '拍子',
    'opt.beatsNote': 'ループの前のカウントもこの数になります',
    'opt.display': '表示',
    'opt.lang': '言語',
    'opt.langNote': 'Language',
    'opt.lang.auto': '自動',
    'opt.labels': '鍵盤の音名',
    'opt.labelsNote': '鍵盤の下に音の名前を表示',
    'opt.labels.none': 'なし',
    'opt.labels.c': 'Cだけ',
    'opt.labels.all': 'すべて',
    'opt.noteStyle': '音名の書き方',
    'opt.noteStyleNote': 'C D E(英語)か、ドレミ(日本語)か',
    'opt.noteStyle.doremi': 'ドレミ',
    'opt.pcHints': 'キーボードの文字',
    'opt.pcHintsNote': '外付けキーボードで弾くときのキーを鍵盤に表示',
    'opt.reset': '設定を最初の状態に戻す',

    'help.credit': 'ピアノの音: Salamander Grand Piano(Alexander Holm, CC BY 3.0)を加工して使用',
};

const en = {
    'rec.start': 'Record',
    'rec.cancel': 'Cancel recording',
    'rec.stop': 'Stop recording',
    'metro.start': 'Start metronome',
    'metro.stop': 'Stop metronome',
    'loop.idle': 'Record a loop',
    'loop.countin': 'Cancel loop recording',
    'loop.recording': 'Finish loop recording',
    'loop.countdown': 'Cancel loop playback',
    'loop.playing': 'Stop loop',
    'loop.paused': 'Play loop',
    'loop.delete': 'Delete loop',
    'loop.timeline': 'Loop timeline',
    'rows.one': 'Show one row',
    'rows.two': 'Show two rows',
    'menu': 'Menu',
    'status.loading': 'Loading sounds…',
    'status.synth': 'Synth sound',
    'saveFailed': "Couldn't save the recording. Your device may be low on storage. Delete some old recordings and try again.",

    'menu.back': 'Back',
    'menu.close': 'Close',
    'menu.recordings': 'Recordings',
    'menu.help': 'How to use',
    'menu.options': 'Options',
    'menu.unheard': (n) => `${n} new`,

    'recs.empty': 'No recordings yet. Tap the ● button at the top to start recording.',
    'recs.play': 'Play',
    'recs.stop': 'Stop',
    'recs.unheard': 'New',
    'recs.share': 'Share',
    'recs.delete': 'Delete',
    'recs.renamePrompt': 'Recording name',
    'recs.deleteConfirm': (name) => `Delete "${name}"?`,
    'recs.shareFailed': "Couldn't share.",
    'recs.format': 'Share as',
    'recs.mp3Note': 'Audio',
    'recs.midiNote': 'Notes',
    'recs.makingMp3': (p) => `Making MP3… ${p}%`,
    'recs.makingMidi': 'Making MIDI…',
    'err.mp3TooLong': (min) => `Only recordings up to ${min} minutes can be shared as MP3. Try MIDI instead.`,
    'err.samplesLoading': 'The piano sounds are still loading. Please wait a moment and try again.',

    'metro.settings': 'Metronome settings',
    'metro.slower': 'Slower',
    'metro.faster': 'Faster',
    'metro.tempo': 'Tempo',
    'metro.beats3': '3/4',
    'metro.beats4': '4/4',
    'metro.locked': "Can't be changed while a loop is playing",

    'opt.sound': 'Sound',
    'opt.volume': 'Volume',
    'opt.reverb': 'Reverb',
    'opt.reverbNote': 'How much the sound rings, like in a concert hall',
    'opt.reverb.off': 'Off',
    'opt.reverb.low': 'Low',
    'opt.reverb.mid': 'Normal',
    'opt.reverb.high': 'High',
    'opt.touch': 'Touch',
    'opt.touchNote': 'How loud a key plays when you tap it',
    'opt.touch.soft': 'Soft',
    'opt.touch.normal': 'Normal',
    'opt.touch.strong': 'Strong',
    'opt.sustain': 'Pedal',
    'opt.sustainNote': 'Notes keep ringing after you lift your finger until they fade',
    'opt.loopVolume': 'Loop volume',
    'opt.loopVolumeNote': 'How loud the phrase repeated with 🔁 plays',
    'opt.loopVolume.low': 'Quiet',
    'opt.loopVolume.mid': 'A bit quieter',
    'opt.loopVolume.same': 'Same',
    'opt.metronome': 'Metronome',
    'opt.tempo': 'Tempo',
    'opt.tempoLocked': (bpm) => `${bpm} BPM (locked while a loop is playing)`,
    'opt.beats': 'Time signature',
    'opt.beatsNote': 'The count-in before a loop uses the same number',
    'opt.display': 'Display',
    'opt.lang': 'Language',
    'opt.langNote': '言語',
    'opt.lang.auto': 'Auto',
    'opt.labels': 'Note names',
    'opt.labelsNote': 'Show note names at the bottom of the keys',
    'opt.labels.none': 'None',
    'opt.labels.c': 'C only',
    'opt.labels.all': 'All',
    'opt.noteStyle': 'Note name style',
    'opt.noteStyleNote': 'Letters (C D E) or solfège (Do Re Mi)',
    'opt.noteStyle.doremi': 'Do Re Mi',
    'opt.pcHints': 'Keyboard letters',
    'opt.pcHintsNote': 'Show which keys to press on an external keyboard',
    'opt.reset': 'Reset all settings',

    'help.credit': 'Piano sound: Salamander Grand Piano (Alexander Holm, CC BY 3.0), modified',
};

const STRINGS = { ja, en };

// 言語ごとの t(key, ...引数)。見つからない文言は日本語、それもなければ key を返す
const cache = {};
export const makeT = (lang) => {
    if (cache[lang]) return cache[lang];
    const dict = STRINGS[lang] || ja;
    const t = (key, ...args) => {
        const v = dict[key] ?? ja[key] ?? key;
        return typeof v === 'function' ? v(...args) : v;
    };
    t.lang = lang;
    cache[lang] = t;
    return t;
};

// lib のコードが投げるエラー。画面に出すときに code から今の言語の文言にする
export const appError = (code, ...args) => {
    const err = new Error(makeT('ja')(`err.${code}`, ...args));
    err.code = code;
    err.args = args;
    return err;
};

export const errorText = (t, err) => (err?.code ? t(`err.${err.code}`, ...(err.args || [])) : err?.message || '');

const I18nContext = createContext(makeT('ja'));
export const I18nProvider = I18nContext.Provider;
export const useT = () => useContext(I18nContext);
