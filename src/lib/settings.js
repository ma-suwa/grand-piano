// オプション設定(端末の中に保存する)

const STORAGE_KEY = 'simple-piano.settings.v1';

export const DEFAULT_SETTINGS = {
    volume: 70, // 音量(0〜100)
    reverb: 'mid', // 響き: off / low / mid / high
    touch: 'normal', // タッチの強さ: soft / normal / strong
    sustain: false, // ペダル(離しても音をのばす)
    labels: 'c', // 鍵盤の音名: none / c / all
    noteStyle: 'abc', // 音名の書き方: abc (C4, D4 …) / doremi (ド, レ …)
    pcHints: true, // PCキーボードの文字を鍵盤に表示
    loopVolume: 'mid', // ループの音量: low(小さめ) / mid(少し小さめ) / same(同じ)
    tempo: 90, // メトロノームのテンポ(1分間の拍の数)
    beats: 4, // 拍子: 3 / 4
    lang: 'auto', // 言語: auto(端末に合わせる) / ja / en
};

export const REVERB_LEVELS = { off: 0, low: 0.08, mid: 0.16, high: 0.28 };
export const TOUCH_VELOCITY = { soft: 68, normal: 90, strong: 112 };
// ループの音を、弾いたときの強さからどれだけ弱くして鳴らすか
export const LOOP_SOFTER = { low: 24, mid: 12, same: 0 };

export const loadSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
};

export const saveSettings = (settings) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // 保存できない環境ではそのまま
    }
};
