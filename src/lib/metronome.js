// メトロノーム。音声側の時計(ctx.currentTime)で拍を刻む。
// ループ(🔁)は、この拍の並び(小節の頭)に合わせて録音・再生する。
// クリック音はピアノとは別の経路で鳴らし、録音(弾いた音の記録)には入らない

const LOOKAHEAD = 0.12; // 何秒先までの拍を予約するか
const TICK_MS = 25;

export const TEMPO_MIN = 40;
export const TEMPO_MAX = 200;

// sampler: pianoSampler(click と currentTime を使う)
// onBeat(beatInBar, time): 拍が来たときに呼ぶ(画面の表示用。音より少し遅れることがある)
export const createMetronome = (sampler, { onBeat } = {}) => {
    let tempo = 90;
    let beats = 4;
    let audible = false; // 音を鳴らすか(止めていても、ループのために拍だけ刻むことがある)
    let running = false;
    let t0 = 0; // 拍を数え始めた時刻(この時刻が1拍目)
    let next = 0; // 次に予約する拍の番号
    let interval = null;
    const timers = new Set();

    const spb = () => 60 / tempo;
    const beatTime = (i) => t0 + i * spb();

    const later = (fn, sec) => {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, Math.max(0, sec * 1000));
        timers.add(id);
    };

    const tick = () => {
        const now = sampler.currentTime();
        while (beatTime(next) < now + LOOKAHEAD) {
            const at = beatTime(next);
            const inBar = ((next % beats) + beats) % beats;
            if (audible && at >= now - 0.01) sampler.click(at, inBar === 0);
            later(() => onBeat?.(inBar, at), at - now);
            next += 1;
        }
    };

    const clearTimers = () => {
        timers.forEach(clearTimeout);
        timers.clear();
    };

    return {
        // 拍の並びを at(省略時はすぐ)から数え直す。at が1小節目の1拍目になる
        start(at) {
            clearInterval(interval);
            clearTimers();
            t0 = at ?? sampler.currentTime() + 0.05;
            next = 0;
            running = true;
            interval = setInterval(tick, TICK_MS);
            tick();
            return t0;
        },
        stop() {
            running = false;
            clearInterval(interval);
            interval = null;
            clearTimers();
        },
        isRunning: () => running,
        setAudible(v) {
            audible = v;
        },
        // テンポを変える。刻んでいる途中なら、次の拍からそのテンポにする
        setTempo(bpm) {
            const b = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
            if (b === tempo) return;
            if (running) {
                const nextAt = beatTime(next);
                tempo = b;
                t0 = nextAt - next * spb();
            } else tempo = b;
        },
        setBeats(n) {
            beats = n;
        },
        tempo: () => tempo,
        beats: () => beats,
        secondsPerBeat: spb,
        barSeconds: () => beats * spb(),
        // 拍を数え始めた時刻(1小節目の1拍目)
        origin: () => t0,
    };
};
