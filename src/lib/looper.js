// ループ(ルーパー): 弾いたフレーズを一時的に録音して、くり返し鳴らす。
// 左手の伴奏をループさせながら右手のメロディを練習する、といった使い方のための機能。
// メトロノームの小節に合わせて録音し、ループの長さは小節の数(🔁 を押したときに一番近い小節の区切り)にする

const LATE = 0.08; // これより遅れてしまった音は鳴らさない(秒)
const EARLY = 0.15; // 小節の頭より少しだけ早く弾いた音は、頭で弾いたものとみなす(秒)

// ループ用の録音。カウント(4, 3, 2, 1)のあと、小節の頭 startAt から記録する。
// clock: 音声側の時計(sampler.currentTime)。カウント中に弾いた音は入れない
export const createLoopRecorder = (clock, startAt) => {
    const notes = [];
    const now = () => clock() - startAt;
    return {
        // 鍵を押したときに呼ぶ。戻り値の関数を離鍵時に呼ぶ(記録しない音のときは null)
        noteOn(midi, velocity, pedal = false) {
            const t = now();
            if (t < -EARLY) return null;
            const note = { m: midi, v: velocity, t: Math.max(0, t), d: null, p: pedal };
            notes.push(note);
            return () => {
                if (note.d === null) note.d = Math.max(0.03, now() - note.t);
            };
        },
        elapsed: now,
        // 録音を終えてループのデータを返す。length: ループの長さ(秒。小節の長さの整数倍)。
        // ループの長さより後に弾いた音は入れない。何も弾いていなければ null
        stop(length) {
            const end = Math.min(now(), length);
            const kept = notes.filter((n) => n.t < length);
            kept.forEach((n) => {
                if (n.d === null) n.d = Math.max(0.03, end - n.t);
            });
            if (!kept.length) return null;
            return { length, notes: kept.sort((a, b) => a.t - b.t) };
        },
    };
};

// ループを再生する(止めるまでくり返す)。
// 録音の再生と同じく、少し先(0.3秒)までの音だけを順に予約していく
// startAt: 1周目を始める時刻(音声側の時計。先の時刻でもよい)
// scale: 時間の伸び縮み(録音したときとテンポを変えたとき。録音時のテンポ / 今のテンポ)
// softer(): ループの音をどれだけ弱く鳴らすか(打鍵の強さから引く値。途中で変えてもよい)
// onKey(midi, on): 鍵盤を光らせる / onNote(midi, velocity, pedal): 鳴った音を知らせる(● の録音に入れるため)。
// onNote の戻り値の関数は、その音が終わったときに呼ぶ
export const playLoop = (sampler, loop, { startAt, scale = 1, softer = () => 0, onKey, onNote } = {}) => {
    const length = loop.length * scale;
    const notes = loop.notes.map((n) => ({ ...n, t: n.t * scale, d: n.d * scale }));
    const start = startAt ?? sampler.currentTime() + 0.02;
    const timers = new Set();
    const sounding = new Set(); // { stop, end }
    const ends = new Set(); // onNote の戻り値(まだ終わっていない音)
    const lit = new Map(); // midi -> 光らせている数
    let cycle = 0;
    let index = 0;
    let stopped = false;

    const later = (fn, sec) => {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, Math.max(0, sec * 1000));
        timers.add(id);
    };
    const light = (midi, on) => {
        lit.set(midi, (lit.get(midi) || 0) + (on ? 1 : -1));
        onKey?.(midi, on);
    };

    const tick = () => {
        const now = sampler.currentTime();
        sounding.forEach((s) => s.end < now && sounding.delete(s));
        for (;;) {
            if (index >= notes.length) {
                index = 0;
                cycle += 1;
            }
            const n = notes[index];
            const at = start + cycle * length + n.t;
            if (at >= now + 0.3) break;
            index += 1;
            // 予約が間に合わなかった音(画面が隠れてタイマーが遅れたときなど)は鳴らさない。
            // まとめて遅れて鳴ると、一度にたくさんの音が重なってしまうため
            if (at < now - LATE) continue;
            // ペダルを使って弾いた音は、その周の終わりまでのばす
            const duration = n.p ? Math.max(n.d, length - n.t) : n.d;
            const velocity = Math.max(1, n.v - softer());
            const stop = sampler.noteOn(n.m, velocity, at, duration);
            sounding.add({ stop, end: at + duration + 2 });
            let end = null;
            later(() => {
                light(n.m, true);
                end = onNote?.(n.m, velocity, n.p) ?? null;
                if (end) ends.add(end);
            }, at - now);
            later(() => {
                light(n.m, false);
                if (end) {
                    ends.delete(end);
                    end();
                }
            }, at + n.d - now);
        }
    };

    const interval = setInterval(tick, 60);
    tick();

    return {
        // 何秒目を鳴らしているか(0〜length)
        position: () => {
            const t = sampler.currentTime() - start;
            return t < 0 ? 0 : t % length;
        },
        stop() {
            if (stopped) return;
            stopped = true;
            clearInterval(interval);
            timers.forEach(clearTimeout);
            timers.clear();
            sounding.forEach((s) => s.stop());
            sounding.clear();
            ends.forEach((end) => end());
            ends.clear();
            lit.forEach((count, midi) => {
                for (let i = 0; i < count; i++) onKey?.(midi, false);
            });
            lit.clear();
        },
    };
};
