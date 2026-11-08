// 88鍵(A0〜C8)の並びと位置の計算
export const LOWEST_MIDI = 21; // A0
export const HIGHEST_MIDI = 108; // C8

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);

export const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const SOLFEGE = {
    ja: { 0: 'ド', 2: 'レ', 4: 'ミ', 5: 'ファ', 7: 'ソ', 9: 'ラ', 11: 'シ' },
    en: { 0: 'Do', 2: 'Re', 4: 'Mi', 5: 'Fa', 7: 'Sol', 9: 'La', 11: 'Si' },
};

// 白鍵の名前(ドレミ)。lang: 'ja' / 'en'
export const solfegeName = (midi, lang = 'ja') => (SOLFEGE[lang] || SOLFEGE.ja)[midi % 12];

// 白鍵の数(A0〜C8)
export const WHITE_COUNT = 52;

// 白鍵の並び(左から何番目 -> midi)と、白鍵の境目にある黒鍵(境目の番号 -> midi)
export const WHITE_MIDIS = [];
export const BLACK_AT_BOUNDARY = new Map();
for (let midi = LOWEST_MIDI, i = 0; midi <= HIGHEST_MIDI; midi++) {
    if (isBlackKey(midi)) BLACK_AT_BOUNDARY.set(i, midi);
    else WHITE_MIDIS.push(midi), i++;
}

// 88鍵の並び(低い音から)。boundary: 黒鍵が乗っている白鍵の境目の番号(左から何本目の白鍵の左端か)
export const KEYS = [];
for (let midi = LOWEST_MIDI, i = 0; midi <= HIGHEST_MIDI; midi++) {
    if (isBlackKey(midi)) KEYS.push({ midi, black: true, boundary: i });
    else KEYS.push({ midi, black: false }), i++;
}
