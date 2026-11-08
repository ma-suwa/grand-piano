// 録音の保存と再生
// 録音は音そのものではなく「どの鍵を・いつ・どれだけ押したか」の記録として保存する。
// データが小さく、再生時は同じピアノ音源で鳴らし、鍵盤も光らせられる

const STORAGE_KEY = 'simple-piano.recordings.v1';

// 保存した録音の一覧(新しい順)
// 録音 = { id, name, createdAt(ミリ秒), duration(秒), notes: [{ m: midi, v: 強さ, t: 開始(秒), d: 長さ(秒) }] }
export const loadRecordings = () => {
    try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

export const saveRecordings = (list) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
};

// 弾いた音を記録する。stop() で録音データを返す
export const createRecorder = () => {
    const t0 = performance.now();
    const notes = [];
    const now = () => (performance.now() - t0) / 1000;
    return {
        // 鍵を押したときに呼ぶ。戻り値の関数を離鍵時に呼ぶ
        // pedal: ペダル(音をのばす)を使っているか。再生時は離鍵後も音を自然に消えるまで鳴らす
        noteOn(midi, velocity, pedal = false) {
            const note = { m: midi, v: velocity, t: now(), d: null, p: pedal };
            notes.push(note);
            return () => {
                if (note.d === null) note.d = Math.max(0.03, now() - note.t);
            };
        },
        elapsed: now,
        stop() {
            const end = now();
            notes.forEach((n) => {
                if (n.d === null) n.d = Math.max(0.03, end - n.t);
            });
            const round = (x) => Math.round(x * 1000) / 1000;
            return {
                duration: round(Math.max(end, ...notes.map((n) => n.t + n.d), 0)),
                notes: notes.map((n) => ({ m: n.m, v: n.v, t: round(n.t), d: round(n.d), ...(n.p ? { p: 1 } : {}) })),
            };
        },
    };
};

export const PEDAL_SECONDS = 12; // ペダルでのばした音を鳴らす長さの上限(音源自体はこれより前に消える)

// 録音を再生する。一度に全部の音を予約すると iPhone の処理が重くなって音が途切れるので、
// 少し先(0.3秒)までの音だけを順に予約していく
export const playRecording = (sampler, recording, { onKey, onEnd } = {}) => {
    const notes = [...recording.notes].sort((a, b) => a.t - b.t);
    const start = sampler.currentTime() + 0.15;
    const stops = [];
    const timers = new Set();
    const lit = new Map(); // midi -> 光らせている数
    let index = 0;
    let finished = false;

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
        while (index < notes.length && start + notes[index].t < now + 0.3) {
            const n = notes[index++];
            const at = start + n.t;
            // 予約が間に合わなかった音(画面が隠れてタイマーが遅れたときなど)は、まとめて鳴らさずに飛ばす
            if (at < now - 0.08) continue;
            stops.push(sampler.noteOn(n.m, n.v, at, n.p ? PEDAL_SECONDS : n.d));
            later(() => light(n.m, true), at - now);
            later(() => light(n.m, false), at + n.d - now);
        }
        if (index >= notes.length && now > start + recording.duration + 0.3) stop(true);
    };

    const interval = setInterval(tick, 60);
    tick();

    function stop(ended = false) {
        if (finished) return;
        finished = true;
        clearInterval(interval);
        timers.forEach(clearTimeout);
        timers.clear();
        // 最後まで再生したときは、ペダルでのばした音を自然に消えるまで残す
        if (!ended) stops.forEach((s) => s());
        // 光らせたままの鍵を消す
        lit.forEach((count, midi) => {
            for (let i = 0; i < count; i++) onKey?.(midi, false);
        });
        lit.clear();
        onEnd?.(ended);
    }

    return { stop: () => stop(false) };
};

export const formatDuration = (sec) => {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const pad = (n) => String(n).padStart(2, '0');

export const formatDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 新しい録音の名前: 録音した日付と時刻の数字(例 20261103-1324)。同じ名前があれば -2, -3 … をつける
export const defaultName = (ms, list) => {
    const d = new Date(ms);
    const base = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const names = new Set(list.map((r) => r.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
};

// まだ聴いていない録音の数
export const countUnheard = (list) => list.filter((r) => r.unheard).length;
