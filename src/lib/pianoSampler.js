// Web Audio のピアノ音源
// Salamander Grand Piano (Alexander Holm, CC-BY 3.0) の録音を3半音おきに読み込み、
// 間の音は一番近い録音の再生速度を変えて鳴らす。読み込みが終わるまでは合成音で代用する。
//
// 音が途切れないための方針:
// - 発音は「いつ鳴らすか(when)」を音声側の時計で予約する。画面がコマ落ちしても発音はずれない
// - 1音あたりのノードは 音源→音量 の2つだけ(iPhoneで部品を作る処理と音声処理がぶつかって途切れるのを防ぐ)
// - ピアノらしさ: 軽い残響、低音は左・高音は右に少し広げる定位(音域ごとの共有の出口で行う)
// - プチッというノイズ対策: 録音の頭の無音から鳴らし、消すときも急に0にせず、予約した変化を取り消さない
// - 同じ鍵を打ち直したら前の音を短く消す(ピアノのダンパーと同じ)。同時発音数の上限も設ける
// - 和音とペダルで音量が積み上がっても割れないよう、出力の手前にリミッターを置く

import { appError } from './i18n';

const MAX_VOICES = 40;
const SAMPLE_BASE = '/samples/salamander';
const SAMPLE_NOTES = { C: 0, Ds: 3, Fs: 6, A: 9 };
const RESTRIKE_FADE = 0.05; // 同じ鍵の打ち直し・発音数超過で前の音を消すときの減衰(秒)

// A0, C1, Ds1, Fs1, A1, ... A7, C8
const sampleList = () => {
    const list = [{ name: 'A0', midi: 21 }];
    for (let octave = 1; octave <= 7; octave++) {
        for (const [note, pc] of Object.entries(SAMPLE_NOTES)) {
            list.push({ name: `${note}${octave}`, midi: (octave + 1) * 12 + pc });
        }
    }
    list.push({ name: 'C8', midi: 108 });
    return list;
};

// 離鍵したときに音が消えるまでの時定数(秒)。低音ほどゆっくり消える(実際のダンパーに近づける)
const releaseTau = (midi) => (midi < 48 ? 0.22 : midi < 72 ? 0.15 : 0.1);

// 録音の頭にある無音を探す(この分だけ早く鳴らせるので、押してから音が出るまでが短くなる)
const leadingSilence = (buffer) => {
    const data = buffer.getChannelData(0);
    const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.1));
    for (let i = 0; i < limit; i++) {
        if (Math.abs(data[i]) > 0.002) return Math.max(0, i / buffer.sampleRate - 0.002);
    }
    return 0;
};

const decode = (ctx, bytes) => new Promise((resolve, reject) => {
    // 古いSafariはPromise版のdecodeAudioDataに対応していないのでコールバック版を使う
    // (失敗時に null が渡されることがあるので、理由が分かるエラーにする)
    ctx.decodeAudioData(bytes, resolve, (err) => reject(err || new Error('decodeAudioData failed')));
});

// 出力までの共通の経路(音量 → 響き・左右の広がり → リミッター)を作る。
// 演奏用の音声と、録音をファイルに書き出すときの音声(OfflineAudioContext)の両方で同じものを使う
const buildChain = (ctx) => {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.5; // 和音を重ねても出力が割れにくいよう少し控えめに
    master.connect(limiter);

    // 部屋の響き。直接音に少しだけ混ぜる。
    // 畳み込み(ConvolverNode)は iPhone では処理が重く、たまに音声の処理が間に合わず「バチッ」と鳴るので、
    // 遅延とフィードバックだけの軽い残響(櫛形フィルター4本、左右2本ずつ)にしている
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 1;
    master.connect(reverbIn);
    const merger = ctx.createChannelMerger(2);
    [[0.0297, 0], [0.0371, 1], [0.0411, 0], [0.0437, 1]].forEach(([delay, ch]) => {
        const d = ctx.createDelay(0.1);
        d.delayTime.value = delay;
        const fb = ctx.createGain();
        fb.gain.value = 0.72;
        const lp = ctx.createBiquadFilter(); // 響きは高音から先に消える
        lp.type = 'lowpass';
        lp.frequency.value = 3000;
        reverbIn.connect(d);
        d.connect(lp).connect(fb).connect(d);
        lp.connect(merger, 0, ch);
    });
    merger.connect(wet).connect(limiter);

    // 低音は少し左、高音は少し右(弾いている人の位置で聞こえる広がり)。
    // 1音ごとに定位の部品を作ると処理が増えるので、音域ごとの共有の出口を9本用意して振り分ける
    const PAN_STEPS = 9;
    const panBuses = Array.from({ length: PAN_STEPS }, (_, i) => {
        if (!ctx.createStereoPanner) return master;
        const p = ctx.createStereoPanner();
        p.pan.value = -0.4 + (0.8 * i) / (PAN_STEPS - 1);
        p.connect(master);
        return p;
    });
    const busFor = (midi) => panBuses[Math.max(0, Math.min(PAN_STEPS - 1, Math.round(((midi - 21) / 87) * (PAN_STEPS - 1))))];
    return { limiter, master, wet, busFor };
};

export const createPianoSampler = ({ onStatus } = {}) => {
    // iPhoneの消音スイッチがオンでも鳴らす。Web Audio は標準では消音スイッチに従う「ambient」扱いなので、
    // 楽器として「playback」にする(iOS 17以降の WebKit。対応していない環境では何もしない)
    try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
        // 古い環境では設定できなくても困らない
    }
    // 'balanced' は低遅延より安定を優先した出力バッファ。iPadでの音飛びを減らす
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'balanced' });

    const { limiter, master, wet, busFor } = buildChain(ctx);

    // メトロノームのクリック音。響きを通さずに出す(ピアノとは別の経路)。
    // 鳴らすたびに音を作ると重いので、短い音を最初に2種類(1拍目用の高い音・ほかの拍)作っておく
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.35;
    clickGain.connect(limiter);
    const makeClick = (freq) => {
        const len = Math.floor(ctx.sampleRate * 0.05);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            const t = i / ctx.sampleRate;
            const env = Math.min(1, t / 0.001) * Math.exp(-t / 0.009);
            d[i] = Math.sin(2 * Math.PI * freq * t) * env;
        }
        return buf;
    };
    const clickBuffers = { accent: makeClick(1760), beat: makeClick(1175) };

    const samples = []; // { midi, buffer } を midi 昇順で
    const voices = new Set();
    const byKey = new Map(); // midi -> 最後に鳴らした voice
    let closed = false;

    // 音源を読み込む。iPhoneはメモリが少ないので、一度に全部ではなく4つずつ順に読み込み、
    // 読めなかった音があっても残りの音源で鳴らす(近い音の録音で代用される)
    const loadSamples = async () => {
        onStatus?.('loading');
        const list = sampleList();
        const loaded = [];
        const errors = [];
        const loadOne = async ({ name, midi }) => {
            try {
                const res = await fetch(`${SAMPLE_BASE}/${name}.mp3`);
                // iPhoneアプリ(Capacitor)では音声ファイルの応答が status 0 になるが、中身は読めるので失敗扱いにしない
                if (!res.ok && res.status !== 0) throw new Error(`HTTP ${res.status}`);
                const bytes = await res.arrayBuffer();
                if (!bytes.byteLength) throw new Error('empty file');
                const buffer = await decode(ctx, bytes);
                loaded.push({ midi, buffer, offset: leadingSilence(buffer) });
            } catch (err) {
                errors.push(`${name}: ${err?.name || ''} ${err?.message || err}`);
            }
        };
        for (let i = 0; i < list.length; i += 4) {
            await Promise.all(list.slice(i, i + 4).map(loadOne));
            if (closed) return;
        }
        if (errors.length) console.warn(`[pianoSampler] 読み込めなかった音源 ${errors.length}件: ${errors.join(' / ')}`);
        if (!loaded.length) {
            onStatus?.('error');
            return;
        }
        samples.push(...loaded.sort((a, b) => a.midi - b.midi));
        onStatus?.('ready');
    };

    const nearestSample = (midi) => {
        let best = samples[0];
        for (const s of samples) {
            if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
        }
        return best;
    };

    // 1音ごとに「打鍵用の音量」と「ダンパー用の音量」を分けて持つ。
    // 一度予約した音量の変化を取り消す(cancelScheduledValues)と、Safariでは音量が一瞬跳ねて
    // 「ぷつっ」と鳴ることがあるので、ダンパー側は減らす予定を後ろに足していくだけにする
    const makeDamper = () => {
        const g = ctx.createGain();
        g.gain.value = 1;
        return g;
    };

    // at 以降に音を消す(時定数 tau でなめらかに下げる)。まだ鳴り始めていない音は鳴らずに終わる
    const release = (voice, at, tau) => {
        const t = Math.max(at, ctx.currentTime);
        // すでにもっと早く・速く消える予定なら何もしない
        if (voice.damped && voice.damped.at <= t && voice.damped.tau <= tau) return;
        voice.damped = { at: Math.min(t, voice.damped?.at ?? t), tau: Math.min(tau, voice.damped?.tau ?? tau) };
        const g = voice.damp.gain;
        if (t <= voice.start) {
            // 鳴り始める前に取り消す(まだ音が出ていないので、すぐ0にしてよい)
            g.setValueAtTime(0, ctx.currentTime);
            stopAt(voice, voice.start);
            return;
        }
        g.setTargetAtTime(0, t, tau);
        stopAt(voice, t + tau * 10);
    };

    // 音源を止める予定を入れる(すでにもっと早い予定があればそのまま)
    const stopAt = (voice, when) => {
        if (voice.stopAt !== undefined && voice.stopAt <= when) return;
        voice.stopAt = when;
        voice.nodes.forEach((n) => {
            try {
                n.stop(when);
            } catch {
                // 古いSafariは stop() の2回目で例外になるが、音量はすでに下げてあるので問題ない
            }
        });
    };

    const track = (voice, midi) => {
        // 同じ鍵がまだ鳴っていたら、新しい音の打鍵に合わせてダンパーで止める
        const prev = byKey.get(midi);
        if (prev && prev !== voice) release(prev, voice.start, RESTRIKE_FADE);
        byKey.set(midi, voice);

        voices.add(voice);
        voice.nodes[0].onended = () => {
            voices.delete(voice);
            if (byKey.get(midi) === voice) byKey.delete(midi);
            voice.gain.disconnect();
            if (voice.damp !== voice.gain) voice.damp.disconnect();
        };

        // 上限を超えたら、早く鳴り始めた音から消す
        if (voices.size > MAX_VOICES) {
            const oldest = [...voices].reduce((a, b) => (a.start <= b.start ? a : b));
            release(oldest, ctx.currentTime, RESTRIKE_FADE);
            voices.delete(oldest);
        }
    };

    // 1音で作る部品は「録音の再生」と「音量」の2つだけにする。
    // iPhone では、音を鳴らすたびに部品を作ってつなぐ処理と音声の処理がぶつかると、
    // その瞬間の音が途切れて「バチッ」と鳴ることがあるため、部品の数をできるだけ減らしている
    const sampleVoice = (midi, velocity, when, duration) => {
        const sample = nearestSample(midi);
        const v = velocity / 127;
        const source = ctx.createBufferSource();
        source.buffer = sample.buffer;
        source.playbackRate.value = 2 ** ((midi - sample.midi) / 12);
        // 音量は最初から一定(録音の頭はほぼ無音から始まるので、いきなり鳴らしてもプチッとならない)。
        // 離鍵時はこの音量を後から下げる予定を足すだけにする
        const damp = ctx.createGain();
        damp.gain.value = v ** 1.5 * 0.7;
        source.connect(damp).connect(busFor(midi));
        // 録音の頭の無音を飛ばして鳴らす
        source.start(when, sample.offset);
        const voice = { gain: damp, damp, nodes: [source], start: when };
        // duration 秒後に離鍵したように消す(録音の再生で使う。手で弾くときはもっと早く離鍵で止める)
        release(voice, when + Math.max(0.05, duration), releaseTau(midi));
        return voice;
    };

    // 読み込み前の代わりの合成音(倍音を重ねて減衰させる)
    const synthVoice = (midi, velocity, when, duration) => {
        const freq = 440 * 2 ** ((midi - 69) / 12);
        const amp = (velocity / 127) ** 1.6 * 0.2;
        const gain = ctx.createGain();
        const damp = makeDamper();
        gain.connect(damp).connect(busFor(midi));
        const nodes = [[1, 'triangle', 1], [2, 'sine', 0.3]].map(([mult, type, level]) => {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = freq * mult;
            const og = ctx.createGain();
            og.gain.value = level;
            o.connect(og).connect(gain);
            o.start(when);
            return o;
        });
        const g = gain.gain;
        g.setValueAtTime(0.0001, when);
        g.exponentialRampToValueAtTime(amp, when + 0.006);
        g.setTargetAtTime(amp * 0.3, when + 0.006, Math.max(0.3, 1.5 - (midi - 21) * 0.012));
        const voice = { gain, damp, nodes, start: when };
        release(voice, when + Math.max(0.05, duration), 0.06);
        return voice;
    };

    // when: 音声側の時計(ctx.currentTime)での発音時刻 / duration: 実時間で鳴らす長さ(秒)
    // 戻り値の関数を呼ぶと、その時点で鍵盤を離したように音を止める(押している間だけ鳴らす用)
    const noteOn = (midi, velocity, when, duration) => {
        const at = Math.max(when, ctx.currentTime);
        const voice = samples.length
            ? sampleVoice(midi, velocity, at, duration)
            : synthVoice(midi, velocity, at, duration);
        track(voice, midi);
        return () => release(voice, ctx.currentTime, releaseTau(midi));
    };

    const stopAll = () => {
        const now = ctx.currentTime;
        voices.forEach((v) => release(v, now, RESTRIKE_FADE));
        voices.clear();
        byKey.clear();
    };

    // iPadではユーザー操作の中で resume しないと音が出ないので、ボタン操作のたびに呼ぶ
    // iOS では 'suspended' のほかに 'interrupted' になることもあるので、running 以外なら再開する
    const resume = () => {
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
    };

    // iPhone の音声の制限を解除する。タップ(touchend/click)の中で無音を1回鳴らすと、
    // 以降は pointerdown からでも音が出るようになる
    let unlocked = false;
    const unlock = () => {
        resume();
        if (unlocked && ctx.state === 'running') return;
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
        if (ctx.state === 'running') unlocked = true;
    };

    const close = () => {
        closed = true;
        ctx.close();
    };

    // 録音をファイル用の音声に書き出す(画面の再生とは別に、OfflineAudioContext で一気に計算する)。
    // notes: [{ m, v, t(秒), d(鳴らす長さ・秒) }] / duration: 録音の長さ(秒)
    // 演奏と同じ音源・響き・左右の広がりで作り、最後は tail 秒の余韻をつけて静かに消す
    const render = async (notes, duration, { reverb = 0.16, tail = 3 } = {}) => {
        if (!samples.length) throw appError('samplesLoading');
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const rate = ctx.sampleRate;
        const lead = 0.05;
        const total = lead + duration + tail;
        const oc = new OAC(2, Math.ceil(total * rate), rate);
        const out = buildChain(oc);
        out.master.gain.value = 0.7;
        out.wet.gain.value = reverb;
        // 最後の1.2秒で静かに消す
        out.master.gain.setValueAtTime(0.7, total - 1.2);
        out.master.gain.linearRampToValueAtTime(0, total - 0.05);

        const sorted = [...notes].sort((a, b) => a.t - b.t);
        // 同じ鍵を打ち直したら前の音を短く消す(演奏と同じ)
        const nextOn = new Map();
        const ends = sorted.map(() => null);
        for (let i = sorted.length - 1; i >= 0; i--) {
            const n = sorted[i];
            ends[i] = nextOn.get(n.m) ?? Infinity;
            nextOn.set(n.m, lead + n.t);
        }
        sorted.forEach((n, i) => {
            const when = lead + n.t;
            if (when >= total) return;
            const sample = nearestSample(n.m);
            const src = oc.createBufferSource();
            src.buffer = sample.buffer;
            src.playbackRate.value = 2 ** ((n.m - sample.midi) / 12);
            const g = oc.createGain();
            g.gain.value = (n.v / 127) ** 1.5 * 0.7;
            src.connect(g).connect(out.busFor(n.m));
            src.start(when, sample.offset);
            let off = when + Math.max(0.05, n.d);
            let tau = releaseTau(n.m);
            if (ends[i] < off) {
                off = ends[i];
                tau = RESTRIKE_FADE;
            }
            g.gain.setTargetAtTime(0, off, tau);
            src.stop(Math.min(total, off + tau * 10));
        });

        return new Promise((resolve, reject) => {
            oc.oncomplete = (e) => resolve(e.renderedBuffer);
            const p = oc.startRendering();
            if (p && p.then) p.then(resolve, reject);
        });
    };

    loadSamples();

    return {
        noteOn,
        stopAll,
        resume,
        unlock,
        close,
        currentTime: () => ctx.currentTime,
        render,
        // メトロノームのクリックを when(音声側の時刻)に鳴らす。accent: 1拍目
        click: (when, accent) => {
            const src = ctx.createBufferSource();
            src.buffer = accent ? clickBuffers.accent : clickBuffers.beat;
            src.connect(clickGain);
            src.start(Math.max(when, ctx.currentTime));
            src.onended = () => src.disconnect();
        },
        // 予約した音が実際にスピーカーから出るまでの遅れ(秒)。画面と音を合わせるのに使う
        outputLatency: () => (ctx.outputLatency || 0) + (ctx.baseLatency || 0),
        // 音量(0〜1)。急に変えるとプチッと鳴るので少しなめらかに変える
        setVolume: (v) => {
            master.gain.setTargetAtTime(0.7 * v, ctx.currentTime, 0.03);
            clickGain.gain.setTargetAtTime(0.5 * v, ctx.currentTime, 0.03);
        },
        // 響きの量(0 で響きなし)
        setReverb: (level) => {
            wet.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
        },
    };
};
