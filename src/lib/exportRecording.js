// 録音をファイル(MIDI / MP3)にして、共有シート(AirDrop・メッセージ・ファイルに保存など)で渡す。
// 録音は「どの鍵を・いつ・どれだけ押したか」の記録なので、
// MIDI はそのまま書き出し、MP3 はアプリと同じピアノ音源で音声を作ってから変換する

import { PEDAL_SECONDS } from './recordings';
import { appError } from './i18n';

// ファイル名に使えない文字を除く
const fileBase = (name) => (name || 'recording').replace(/[\\/:*?"<>|\n\r\t]/g, '_').trim() || 'recording';

// ---- MIDI ----

const PPQ = 480; // 4分音符1つの細かさ

// 可変長の数値(MIDIの時間の書き方)
const varLen = (value) => {
    let v = Math.max(0, Math.round(value));
    const bytes = [v & 0x7f];
    while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80);
    return bytes;
};

const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

// tempo / beats: いまのメトロノームの設定。メトロノームに合わせて弾いた録音は、
// DAW(GarageBand など)で開いたときに小節の線と合う
export const recordingToMidi = (rec, { tempo = 120, beats = 4, name } = {}) => {
    const ticksPerSec = (PPQ * tempo) / 60;
    const tick = (sec) => Math.max(0, Math.round(sec * ticksPerSec));
    const notes = [...rec.notes].sort((a, b) => a.t - b.t);
    // order: 同じ時刻なら 離鍵 → ペダル → 打鍵 の順
    const events = [];
    const nextOn = new Map();
    for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        const on = tick(n.t);
        let off = Math.max(on + 1, tick(n.t + n.d));
        const next = nextOn.get(n.m);
        if (next !== undefined && next < off) off = Math.max(on, next); // 同じ鍵の打ち直しは前の音をそこで切る
        nextOn.set(n.m, on);
        const vel = Math.max(1, Math.min(127, Math.round(n.v)));
        events.push({ t: on, order: 2, data: [0x90, n.m, vel] });
        events.push({ t: off, order: 0, data: [0x80, n.m, 0] });
    }
    // ペダル(サステイン)。録音には「この音はペダルを使っていたか」が入っているので、
    // ペダルを使った音の間はペダルを踏み、使っていない音が来たら離す
    let pedal = false;
    notes.forEach((n) => {
        if (!!n.p !== pedal) {
            pedal = !!n.p;
            events.push({ t: tick(n.t), order: 1, data: [0xb0, 64, pedal ? 127 : 0] });
        }
    });
    const endTick = Math.max(tick(rec.duration), ...events.map((e) => e.t));
    if (pedal) events.push({ t: endTick, order: 1, data: [0xb0, 64, 0] });
    events.sort((a, b) => a.t - b.t || a.order - b.order);

    const title = Array.from(new TextEncoder().encode(name || rec.name || ''));
    const usPerBeat = Math.round(60000000 / tempo);
    const track = [
        ...varLen(0), 0xff, 0x03, ...varLen(title.length), ...title, // 曲名
        ...varLen(0), 0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff, // テンポ
        ...varLen(0), 0xff, 0x58, 0x04, beats, 2, 24, 8, // 拍子(beats/4)
        ...varLen(0), 0xc0, 0, // 音色: アコースティックピアノ
    ];
    let last = 0;
    events.forEach((e) => {
        track.push(...varLen(e.t - last), ...e.data);
        last = e.t;
    });
    track.push(...varLen(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00); // トラックの終わり

    const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
    return new Uint8Array([...header, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track]);
};

// ---- MP3 ----

const MP3_MAX_SECONDS = 10 * 60;

const pause = () => new Promise((r) => setTimeout(r, 0));

// 書き出した音声を、一番大きいところが -1dB になるまで持ち上げる(4倍まで)
const normalize = (buffer) => {
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
        }
    }
    return peak > 0 ? Math.min(4, 0.89 / peak) : 1;
};

// AudioBuffer → MP3 (ステレオ 192kbps)。途中で画面が固まらないよう少しずつ変換する
export const encodeMp3 = async (buffer, onProgress) => {
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const gain = normalize(buffer);
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const encoder = new Mp3Encoder(2, buffer.sampleRate, 192);
    const BLOCK = 1152 * 40;
    const toInt16 = (src, from, to) => {
        const out = new Int16Array(to - from);
        for (let i = from; i < to; i++) {
            const s = Math.max(-1, Math.min(1, src[i] * gain));
            out[i - from] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    };
    const parts = [];
    let lastPause = performance.now();
    for (let i = 0; i < left.length; i += BLOCK) {
        const end = Math.min(left.length, i + BLOCK);
        const chunk = encoder.encodeBuffer(toInt16(left, i, end), toInt16(right, i, end));
        if (chunk.length) parts.push(new Uint8Array(chunk));
        if (performance.now() - lastPause > 30) {
            onProgress?.(end / left.length);
            await pause();
            lastPause = performance.now();
        }
    }
    const tail = encoder.flush();
    if (tail.length) parts.push(new Uint8Array(tail));
    const size = parts.reduce((n, p) => n + p.length, 0);
    const mp3 = new Uint8Array(size);
    let pos = 0;
    parts.forEach((p) => {
        mp3.set(p, pos);
        pos += p.length;
    });
    return mp3;
};

// ---- 共有 ----

const toBase64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
};

const isCancel = (err) => /cancel|abort/i.test(`${err?.name || ''} ${err?.message || err || ''}`);

// iPhone / Mac アプリでは共有シートを開く。ブラウザでは共有(できれば)かダウンロード
export const shareFile = async (fileName, mime, bytes) => {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const { uri } = await Filesystem.writeFile({
            path: `share/${fileName}`,
            data: toBase64(bytes),
            directory: Directory.Cache,
            recursive: true,
        });
        try {
            await Share.share({ files: [uri], dialogTitle: fileName });
        } catch (err) {
            if (!isCancel(err)) throw err;
        }
        return;
    }
    const file = new File([bytes], fileName, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
            return;
        } catch (err) {
            if (isCancel(err)) return;
            // 共有できなかったときはダウンロードにする
        }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// 録音を format ('mp3' | 'midi') のファイルにして共有する。
// onProgress(0〜1): MP3 の変換の進み具合
export const exportRecording = async (sampler, rec, format, { tempo, beats, reverb, onProgress } = {}) => {
    const base = fileBase(rec.name);
    if (format === 'midi') {
        await shareFile(`${base}.mid`, 'audio/midi', recordingToMidi(rec, { tempo, beats }));
        return;
    }
    // 音声は一度に全部をメモリの上で作るので、長すぎる録音は iPhone のメモリが足りなくなる
    if (rec.duration > MP3_MAX_SECONDS) {
        throw appError('mp3TooLong', MP3_MAX_SECONDS / 60);
    }
    onProgress?.(0);
    // ペダルを使った音は、演奏と同じように自然に消えるまで鳴らす
    const notes = rec.notes.map((n) => ({ ...n, d: n.p ? PEDAL_SECONDS : n.d }));
    const audio = await sampler.render(notes, rec.duration, { reverb });
    const mp3 = await encodeMp3(audio, (f) => onProgress?.(f));
    await shareFile(`${base}.mp3`, 'audio/mpeg', mp3);
};
