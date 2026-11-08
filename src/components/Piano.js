"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Key from './Key';
import Icon from './Icon';
import Minimap from './Minimap';
import Menu from './Menu';
import { BLACK_AT_BOUNDARY, KEYS, WHITE_COUNT, WHITE_MIDIS, noteName, solfegeName } from '@/lib/keys';
import { createPianoSampler } from '@/lib/pianoSampler';
import {
    countUnheard,
    createRecorder,
    defaultName,
    formatDuration,
    loadRecordings,
    playRecording,
    saveRecordings,
} from '@/lib/recordings';
import { createLoopRecorder, playLoop } from '@/lib/looper';
import { createMetronome } from '@/lib/metronome';
import MetronomePanel from './MetronomePanel';
import LoopTimeline from './LoopTimeline';
import { exportRecording } from '@/lib/exportRecording';
import { LOOP_SOFTER, REVERB_LEVELS, TOUCH_VELOCITY, loadSettings, saveSettings } from '@/lib/settings';
import { I18nProvider, makeT, resolveLang } from '@/lib/i18n';
import styles from './Piano.module.css';

const HOLD_SECONDS = 30; // 押しっぱなしのときに鳴らし続ける上限(秒)
const GLISS_SOFTER = 12; // グリッサンドで隣の鍵へ移ったときは少し弱く鳴らす
const SUSTAIN_KEEP_SECONDS = 15; // ペダルでのばしている音を覚えておく時間(これより古い音はもう消えている)
const MIN_COUNT = 14; // 一番拡大したときに見える白鍵の数(2オクターブ・24鍵)
const MAX_COUNT = 21; // 一番縮小したときに見える白鍵の数(3オクターブ・36鍵。これ以上は鍵盤が細くなりすぎる)
// 黒鍵の長さ(鍵盤の高さに対する割合)。見える鍵が少ない(鍵盤が太い)ほど長めにする
// 実際のピアノは白鍵 約150mm に対して黒鍵 約90mm(約0.6倍)。指で押しやすいよう少しだけ長めにして、
// 白鍵の長さの 0.62倍(一番縮小) 〜 0.68倍(一番拡大) にする
const blackRatio = (count) => 0.62 + (0.06 * (MAX_COUNT - Math.min(MAX_COUNT, count))) / (MAX_COUNT - MIN_COUNT);
// 鍵盤の隙間や影の太さは鍵盤の幅に合わせて変える(画面幅や拡大率が変わっても見た目の比率が同じになる)。
// 白鍵1本ぶんの幅(space)に対する割合。56px のとき隙間 2px・基準の文字サイズ 16px
const GAP_RATIO = 2 / 56;
const EM_RATIO = 16 / 56;
// ただし段の高さが低いときは、影の太さを高さに合わせて抑える(高さ160pxのとき 16px が上限)
const EM_PER_HEIGHT = 16 / 160;
// 鍵盤の上下の余白(Piano.module.css の .keyboard の padding。em 単位)
const PAD_TOP_EM = 0.875;
const PAD_BOTTOM_EM = 1.125;
const keyEm = (space, rowHeight) => Math.min(space * EM_RATIO, rowHeight * EM_PER_HEIGHT);
// 黒鍵の下端の位置(段の上からの px)。白鍵の見えている長さに blackRatio をかけた長さだけ、白鍵の上端から下に出す
const blackBottom = (space, rowHeight, count) => {
    const em = keyEm(space, rowHeight);
    return em * PAD_TOP_EM + blackRatio(count) * (rowHeight - em * (PAD_TOP_EM + PAD_BOTTOM_EM));
};
const keyGap = (space) => Math.max(1, Math.round(space * GAP_RATIO));
// 鍵の大きさと位置は、鍵盤の要素に置いた --space(白鍵1本ぶんの幅)と --gap(隙間)から CSS で計算する。
// こうすると拡大縮小しても鍵の要素(88鍵×段の数)を作り直さずに済み、鍵盤の幅を変える処理が軽くなる
const WHITE_STYLE = { width: 'calc(var(--space) - var(--gap))' };
const BLACK_W = '0.6 * (var(--space) - var(--gap))'; // 黒鍵の幅は白鍵の 0.6倍
const blackStyle = (boundary) => ({ left: `calc(${boundary} * var(--space) - ${BLACK_W} / 2)`, width: `calc(${BLACK_W})` });
const KEY_STYLES = new Map(KEYS.map((k) => [k.midi, k.black ? blackStyle(k.boundary) : WHITE_STYLE]));

// 2本指をそろえて横に動かしたとき、和音ではなく「左右の移動」とみなす動きの大きさ(px)
const PAN_START_PX = 18;
// 長押しとみなす時間(ミリ秒)。🔁: 今のループを消して録り直す / メトロノーム: テンポの調整を出す
const LONG_PRESS_MS = 600;
// 1段/2段の切り替え。最初は、この幅より狭い画面(スマホなど)なら2段にする
const TWO_ROWS_BELOW = 1000;
// iPad などの大きな画面では、1段の高さを白鍵の幅のこの倍数までにする(実物の鍵盤に近い縦横比。余りは上下の余白)
const ROW_MAX_RATIO = 6.5;
const ROWS_PREF_KEY = 'simple-piano.rows';

// PCキーボードの配置(物理キー) -> 基準のCからの半音数。
// A S D F G H J K L ; が白鍵、W E T Y U O P が黒鍵
const KEY_MAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
    KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};
const HINT_OF = Object.fromEntries(
    Object.entries(KEY_MAP).map(([code, offset]) => [offset, code === 'Semicolon' ? ';' : code.slice(3)])
);

// ループ(🔁)ボタンの見た目と読み上げ
const LOOP_CLASS = { countin: 'loopArmed', recording: 'recording', countdown: 'loopPlaying', playing: 'loopPlaying', paused: 'loopPaused' };
// ループが動いている(メトロノームの拍に合わせている)状態
const LOOP_ACTIVE = new Set(['countin', 'recording', 'countdown', 'playing']);
// ループを録音しているときだけメトロノームを自動で鳴らす(流すときは自動では鳴らさない)
const LOOP_METRO_AUTO = new Set(['countin', 'recording']);

// 録音を端末に保存できなかったとき(空き容量が足りないときなど)に知らせる。
// 画面には残っているので、アプリを閉じる前に古い録音を消してもらう
const notifySaveFailed = (t) => {
    setTimeout(() => window.alert(t('saveFailed')), 0);
};

// 表示範囲を88鍵の中に収める。
// start: 下の段(1段のときはその段)の左端、upperStart: 上の段の左端、count: 1段に見える白鍵の数(両段共通)
const clampView = ({ start, count, upperStart }) => {
    const c = Math.max(MIN_COUNT, Math.min(MAX_COUNT, count));
    const clamp = (x) => Math.max(0, Math.min(WHITE_COUNT - c, x));
    return { start: clamp(start), count: c, upperStart: clamp(upperStart ?? start + c) };
};

// 88鍵のピアノ。鍵盤は画面幅いっぱいに表示し、上の縮小図・2本指スワイプで見える範囲を変える
export default function Piano() {
    const rowsRef = useRef(null); // 鍵盤の段をまとめた要素(指の操作を受ける)
    const rowElsRef = useRef([]); // 各段の要素と、その段の左端を view のどの項目に持つか
    const samplerRef = useRef(null);
    const keyElsRef = useRef(new Map()); // midi -> 鍵盤の要素(2段のときは同じ鍵が2つある)
    const activeCountRef = useRef(new Map()); // midi -> 押している指・キーの数
    const heldCodesRef = useRef(new Map()); // 押しているPCキー -> 止める関数
    const [soundStatus, setSoundStatus] = useState('loading');
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0); // 鍵盤の段をまとめた部分の高さ
    const [view, setViewState] = useState(null); // { start, count, upperStart }(clampView を参照)
    const viewRef = useRef(null);
    const [twoRows, setTwoRows] = useState(null); // 2段表示か(null は未決定)
    const [recording, setRecording] = useState(null); // 録音中なら { recorder, startedAt }
    const recorderRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    const [recordings, setRecordings] = useState([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [settings, setSettingsState] = useState(null); // オプション設定(lib/settings.js)
    const settingsRef = useRef(null);
    const tRef = useRef(makeT('ja'));
    const sustainedRef = useRef([]); // ペダルでのばしている音: [離した時刻, 止める関数]
    const [playingId, setPlayingId] = useState(null);
    const playerRef = useRef(null);
    // ループ: idle(なし) / countin(録音前のカウント 4, 3, 2, 1) / recording(録音中) /
    //         countdown(流す前のカウント) / playing(くり返し再生中) / paused(止めている)
    const [loopPhase, setLoopPhaseState] = useState('idle');
    const loopPhaseRef = useRef('idle');
    const loopRecRef = useRef(null); // ループ用の録音
    const loopRecStartRef = useRef(0); // ループの録音を始めた時刻(音声側の時計)
    const loopEndingRef = useRef(false); // 録音を終える小節の区切りを待っている
    const loopRef = useRef(null); // 録音したループ { length, notes, tempo }
    const loopPlayerRef = useRef(null);
    const loopTimersRef = useRef(new Set());
    const loopCountRef = useRef(new Map()); // midi -> ループで光らせている数
    const [loopBar, setLoopBar] = useState(1); // 録音中の小節(1, 2, …)
    const [loopRun, setLoopRun] = useState(0); // ループを流し始めた回数(進み具合の表示を最初からにするため)
    const [countIn, setCountIn] = useState(0); // カウントの数字(0 は表示しない)
    // メトロノーム
    const metroRef = useRef(null);
    const metroBtnRef = useRef(null);
    const [metroOn, setMetroOnState] = useState(false);
    const metroOnRef = useRef(false);
    const metroAutoRef = useRef(false); // ループのために自動でつけたか
    const [metroPanel, setMetroPanel] = useState(false);

    const setView = useCallback((next) => {
        const v = clampView(typeof next === 'function' ? next(viewRef.current) : next);
        viewRef.current = v;
        setViewState(v);
    }, []);

    // 打鍵の強さ(オプションの「タッチの強さ」)
    const velocity = () => TOUCH_VELOCITY[settingsRef.current?.touch] ?? TOUCH_VELOCITY.normal;

    // ページを開いた時点で音源の読み込みを始める(音が出るのは最初に鍵盤を押したあと)
    useEffect(() => {
        samplerRef.current = createPianoSampler({ onStatus: setSoundStatus });
        // 拍が来たらメトロノームのボタンを光らせる(1拍目は強く)
        metroRef.current = createMetronome(samplerRef.current, {
            onBeat: (inBar) => {
                const el = metroBtnRef.current;
                if (!el) return;
                const cls = inBar === 0 ? 'beatAccent' : 'beat';
                el.dataset.beat = cls;
                clearTimeout(el.beatTimer);
                el.beatTimer = setTimeout(() => delete el.dataset.beat, 110);
            },
        });
        const saved = loadSettings();
        settingsRef.current = saved;
        setSettingsState(saved);
        // iPhone は pointerdown だけでは音声が許可されないことがあるので、
        // 指を離したとき・クリック・キー入力のたびに音声を有効にする
        const unlock = () => samplerRef.current?.unlock();
        const events = ['touchstart', 'touchend', 'pointerup', 'click', 'keydown'];
        events.forEach((t) => window.addEventListener(t, unlock, { capture: true, passive: true }));
        return () => {
            events.forEach((t) => window.removeEventListener(t, unlock, { capture: true }));
            metroRef.current?.stop();
            samplerRef.current?.close();
            samplerRef.current = null;
        };
    }, []);

    // 鍵盤の表示幅を測る。最初は中央のC(C4)が真ん中に来るようにする
    useEffect(() => {
        const el = rowsRef.current;
        const measure = () => {
            rowRectsRef.current = null;
            const w = el.clientWidth;
            setWidth(w);
            setHeight(el.clientHeight);
            if (!viewRef.current) {
                // 1段/2段は前回の選択を使い、なければ画面の幅で決める
                // (縦長の画面も2段にする: iPad の縦向きなど)
                let two = w < TWO_ROWS_BELOW || window.innerHeight > window.innerWidth;
                try {
                    const saved = localStorage.getItem(ROWS_PREF_KEY);
                    if (saved) two = saved === '2';
                } catch {
                    // 保存できない環境ではそのまま
                }
                setTwoRows(two);
                // 最初は中央のC(C4)が真ん中あたりに来るようにする。2段のときは上の段にその右隣を表示
                const count = Math.max(MIN_COUNT, Math.min(MAX_COUNT, w / 56));
                const c4 = WHITE_MIDIS.indexOf(60);
                const start = two ? c4 - count / 2 : c4 + 0.5 - count / 2;
                setView({ start, count, upperStart: start + count });
            }
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [setView]);

    // 鍵盤の点灯(同じ鍵を複数の指やキーで押していても、全部離れるまで点灯させておく)
    const lightKey = (midi, on) => {
        const counts = activeCountRef.current;
        const n = (counts.get(midi) || 0) + (on ? 1 : -1);
        if (n > 0) counts.set(midi, n);
        else counts.delete(midi);
        keyElsRef.current.get(midi)?.forEach((el) => el.classList.toggle('active', n > 0));
    };

    // ループで鳴っている鍵は別の色で光らせる(自分で弾いた音と区別するため)
    const lightLoopKey = (midi, on) => {
        const counts = loopCountRef.current;
        const n = (counts.get(midi) || 0) + (on ? 1 : -1);
        if (n > 0) counts.set(midi, n);
        else counts.delete(midi);
        keyElsRef.current.get(midi)?.forEach((el) => el.classList.toggle('loop', n > 0));
    };

    // メトロノームを鳴らすか・拍を刻むかを今の状態に合わせる。
    // 鳴らさないときでも、ループが動いている間は小節に合わせるため拍だけ刻む
    const applyMetronome = () => {
        const m = metroRef.current;
        if (!m) return;
        const need = metroOnRef.current || LOOP_ACTIVE.has(loopPhaseRef.current);
        m.setAudible(metroOnRef.current);
        if (need && !m.isRunning()) m.start();
        if (!need && m.isRunning()) m.stop();
    };
    const setMetroOn = (on) => {
        metroOnRef.current = on;
        setMetroOnState(on);
        applyMetronome();
    };

    // ループを録音している間はメトロノームを自動でつけ、終わったら元に戻す
    const setLoopPhase = (phase) => {
        loopPhaseRef.current = phase;
        setLoopPhaseState(phase);
        if (LOOP_METRO_AUTO.has(phase) && !metroOnRef.current) {
            metroAutoRef.current = true;
            setMetroOn(true);
        } else if (!LOOP_METRO_AUTO.has(phase) && metroAutoRef.current) {
            metroAutoRef.current = false;
            setMetroOn(false);
        } else applyMetronome();
    };

    // 音を鳴らして点灯する。戻り値を呼ぶと音を止めて消灯する
    const playNote = useCallback((midi, velocity) => {
        const sampler = samplerRef.current;
        lightKey(midi, true);
        let stopSound = null;
        if (sampler) {
            sampler.unlock();
            stopSound = sampler.noteOn(midi, velocity, sampler.currentTime(), HOLD_SECONDS);
        }
        // 録音中なら記録する
        const endRecord = recorderRef.current?.noteOn(midi, velocity, !!settingsRef.current?.sustain);
        // ループの録音中なら記録する(録音前のカウント中に弾いた音は入らない)
        const endLoop = loopRecRef.current?.noteOn(midi, velocity, !!settingsRef.current?.sustain);
        let done = false;
        return () => {
            if (done) return;
            done = true;
            endRecord?.();
            endLoop?.();
            lightKey(midi, false);
            if (!stopSound) return;
            // ペダルを使っているときは、指を離しても音を止めずに自然に消えるまで鳴らす
            if (settingsRef.current?.sustain) {
                const now = performance.now();
                const list = sustainedRef.current.filter(([t]) => now - t < SUSTAIN_KEEP_SECONDS * 1000);
                list.push([now, stopSound]);
                sustainedRef.current = list;
            } else {
                stopSound();
            }
        };
    }, []);

    // 画面上の位置 -> その下にある鍵盤(なければ null)。2段のときは指がある段で判定する
    // 段の位置は、指を置いたとき・画面の大きさが変わったときに測り直して覚えておく。
    // 指を動かすたびに測ると、鍵の点灯で変わった見た目の再計算がそのたびに走って重くなるため
    const rowRectsRef = useRef(null);
    const rowRects = useCallback(() => {
        if (!rowRectsRef.current) {
            rowRectsRef.current = rowElsRef.current.filter((row) => row?.el).map(({ el, key }) => ({ r: el.getBoundingClientRect(), key }));
        }
        return rowRectsRef.current;
    }, []);
    const keyAt = useCallback((clientX, clientY) => {
        const v = viewRef.current;
        if (!v) return null;
        for (const { r, key } of rowRects()) {
            if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
            const space = r.width / v.count;
            const u = v[key] + (clientX - r.left) / space; // 白鍵何個ぶんの位置か
            if (u < 0 || u >= WHITE_COUNT) return null;
            if (clientY - r.top < blackBottom(space, r.height, v.count)) {
                const b = Math.round(u);
                const black = BLACK_AT_BOUNDARY.get(b);
                const half = ((space - keyGap(space)) * 0.6) / 2 / space;
                if (black !== undefined && Math.abs(u - b) < half) return black;
            }
            return WHITE_MIDIS[Math.floor(u)];
        }
        return null;
    }, [rowRects]);

    // 鍵盤の上の指・マウスの処理
    // 1本指: 押すと鳴り、そのまま横に滑らせるとグリッサンド
    // 2本指: そろって横に動かすと左右に移動(動き出すまでは和音として鳴る)。拡大縮小は上の縮小図で行う
    useEffect(() => {
        const el = rowsRef.current;
        const pointers = new Map(); // pointerId -> { x, y, midi, stop, ignored }
        let pair = null; // 2本指になった瞬間の位置と表示範囲
        let gesture = null; // 移動・拡大縮小中の状態

        const releaseAll = () => {
            pointers.forEach((p) => {
                p.stop?.();
                p.stop = null;
                p.midi = null;
                p.ignored = true;
            });
        };

        // 2本指が置かれている段(その段の範囲を動かす)
        const rowKeyAt = (y) => {
            for (const { r, key } of rowRects()) {
                if (y >= r.top && y <= r.bottom) return key;
            }
            return 'start';
        };

        const snapshot = () => {
            const [a, b] = [...pointers.entries()];
            const r = el.getBoundingClientRect();
            return {
                ids: [a[0], b[0]],
                ax: a[1].x, bx: b[1].x,
                midX: (a[1].x + b[1].x) / 2,
                rowKey: rowKeyAt((a[1].y + b[1].y) / 2),
                view: viewRef.current,
                width: r.width,
            };
        };

        const applyGesture = () => {
            const a = pointers.get(gesture.ids[0]);
            const b = pointers.get(gesture.ids[1]);
            if (!a || !b) return;
            const v0 = gesture.view;
            // 指が動いたぶんだけ鍵盤も動かす(指の下の鍵が指についてくる)
            const moved = (a.x + b.x) / 2 - gesture.midX;
            const key = gesture.rowKey;
            setView({ ...viewRef.current, [key]: v0[key] - moved / (gesture.width / v0.count) });
        };

        const onDown = (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (pointers.size === 0) rowRectsRef.current = null; // 最初の指で段の位置を測り直す
            if (e.pointerType === 'mouse') el.setPointerCapture?.(e.pointerId);
            const p = { x: e.clientX, y: e.clientY, midi: null, stop: null, ignored: !!gesture };
            pointers.set(e.pointerId, p);
            if (!p.ignored) {
                const midi = keyAt(e.clientX, e.clientY);
                if (midi != null) {
                    p.midi = midi;
                    p.stop = playNote(midi, velocity());
                }
            }
            pair = pointers.size === 2 && !gesture ? snapshot() : null;
        };

        const onMove = (e) => {
            const p = pointers.get(e.pointerId);
            if (!p) return;
            p.x = e.clientX;
            p.y = e.clientY;

            if (gesture) {
                applyGesture();
                return;
            }
            if (pair && pointers.size === 2) {
                const a = pointers.get(pair.ids[0]);
                const b = pointers.get(pair.ids[1]);
                const da = a.x - pair.ax;
                const db = b.x - pair.bx;
                const panning = Math.sign(da) === Math.sign(db) && Math.abs(da) > PAN_START_PX && Math.abs(db) > PAN_START_PX;
                if (panning) {
                    // ここからは鍵盤を弾くのではなく、表示範囲の操作にする
                    releaseAll();
                    gesture = pair;
                    pair = null;
                    applyGesture();
                    return;
                }
            }
            if (p.ignored) return;
            if (e.pointerType === 'mouse' && !(e.buttons & 1)) return;

            // グリッサンド: 指の下の鍵が変わったら、前の鍵を離して次の鍵を鳴らす
            const midi = keyAt(e.clientX, e.clientY);
            if (midi === p.midi) return;
            p.stop?.();
            p.stop = null;
            p.midi = midi;
            if (midi != null) p.stop = playNote(midi, velocity() - GLISS_SOFTER);
        };

        const onUp = (e) => {
            const p = pointers.get(e.pointerId);
            if (!p) return;
            p.stop?.();
            pointers.delete(e.pointerId);
            pair = null;
            if (gesture) {
                // 1本でも離したら操作は終わり。残った指は離すまで鳴らさない
                gesture = null;
                pointers.forEach((q) => (q.ignored = true));
            }
        };

        // マウスホイール/トラックパッド: 横スクロールで移動、ピンチ(ctrl+ホイール)で拡大縮小
        const onWheel = (e) => {
            e.preventDefault();
            const v = viewRef.current;
            const r = el.getBoundingClientRect();
            const space = r.width / v.count;
            if (e.ctrlKey) {
                // トラックパッドのピンチ: マウスの位置を中心に拡大縮小
                const anchor = v.start + (e.clientX - r.left) / space;
                const count = Math.max(MIN_COUNT, Math.min(MAX_COUNT, v.count * Math.exp(e.deltaY * 0.01)));
                const upperCenter = v.upperStart + v.count / 2;
                setView({ start: anchor - (e.clientX - r.left) / (r.width / count), count, upperStart: upperCenter - count / 2 });
            } else {
                // マウスがある段を動かす
                const key = rowKeyAt(e.clientY);
                const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                setView({ ...v, [key]: v[key] + d / space });
            }
        };

        // iPhoneで長押しの文字選択・拡大鏡・スクロールが出ないようにする
        const stopTouch = (e) => e.preventDefault();
        const stopGesture = (e) => e.preventDefault();

        // アプリが裏に回ったり別のウィンドウに移ったりしたら、押したままの音を止める
        // (指を離したことが届かず、音が鳴りっぱなし・鍵が光りっぱなしになるのを防ぐ)
        const onHide = (e) => {
            if (e.type === 'visibilitychange' && document.visibilityState !== 'hidden') return;
            releaseAll();
            pointers.clear();
            pair = null;
            gesture = null;
        };

        el.addEventListener('pointerdown', onDown);
        window.addEventListener('blur', onHide);
        document.addEventListener('visibilitychange', onHide);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
        el.addEventListener('lostpointercapture', onUp);
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('touchstart', stopTouch, { passive: false });
        el.addEventListener('touchmove', stopTouch, { passive: false });
        document.addEventListener('gesturestart', stopGesture);
        return () => {
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onUp);
            el.removeEventListener('lostpointercapture', onUp);
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('touchstart', stopTouch);
            el.removeEventListener('touchmove', stopTouch);
            document.removeEventListener('gesturestart', stopGesture);
            window.removeEventListener('blur', onHide);
            document.removeEventListener('visibilitychange', onHide);
            releaseAll();
        };
    }, [keyAt, playNote, setView, rowRects]);

    // PCキーボードの割り当ては、画面に見えている一番左のCから始める(C8の手前のC7まで)
    const baseC = useMemo(() => {
        if (!view) return 60;
        const first = Math.ceil(view.start - 0.05);
        const c = WHITE_MIDIS.slice(first).find((m) => m % 12 === 0);
        return Math.min(c ?? 96, 96);
    }, [view]);
    const baseCRef = useRef(baseC);
    baseCRef.current = baseC;

    // PCキーボードで弾く。←→ キーで1オクターブずつ移動
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                e.preventDefault();
                setView((v) => ({ ...v, start: v.start + (e.code === 'ArrowLeft' ? -7 : 7) }));
                return;
            }
            const offset = KEY_MAP[e.code];
            if (offset === undefined || e.repeat || heldCodesRef.current.has(e.code)) return;
            e.preventDefault();
            heldCodesRef.current.set(e.code, playNote(baseCRef.current + offset, velocity()));
        };
        const onKeyUp = (e) => {
            const stop = heldCodesRef.current.get(e.code);
            if (!stop) return;
            heldCodesRef.current.delete(e.code);
            stop();
        };
        // 別のアプリに切り替えると keyup が届かないので、そのときは押しているキーの音を全部止める
        const releaseKeys = () => {
            heldCodesRef.current.forEach((stop) => stop());
            heldCodesRef.current.clear();
        };
        const onHidden = () => document.visibilityState === 'hidden' && releaseKeys();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', releaseKeys);
        document.addEventListener('visibilitychange', onHidden);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', releaseKeys);
            document.removeEventListener('visibilitychange', onHidden);
            releaseKeys();
        };
    }, [playNote, setView]);

    // 録音: 開始/停止。停止したら一覧に保存する(何も弾いていなければ保存しない)
    useEffect(() => setRecordings(loadRecordings()), []);
    const recTimersRef = useRef(new Set());
    const [recCount, setRecCount] = useState(0); // 録音前のカウントの数字(0 は表示しない)
    const clearRecCount = () => {
        recTimersRef.current.forEach(clearTimeout);
        recTimersRef.current.clear();
        setRecCount(0);
    };
    // 録音前に1小節ぶん 4, 3, 2, 1(3拍子なら 3, 2, 1)と数えてから録音を始める。
    // メトロノームを鳴らしているときは、その拍に合わせて数える
    const startRecCount = () => {
        const sampler = samplerRef.current;
        const m = metroRef.current;
        if (!sampler || !m) return;
        sampler.unlock();
        const beats = m.beats();
        const spb = m.secondsPerBeat();
        const t0 = metroOnRef.current && !LOOP_ACTIVE.has(loopPhaseRef.current) ? m.start() : sampler.currentTime() + 0.05;
        const at = (time, fn) => {
            const id = setTimeout(() => {
                recTimersRef.current.delete(id);
                fn();
            }, Math.max(0, (time - sampler.currentTime()) * 1000));
            recTimersRef.current.add(id);
        };
        setRecording({ counting: true });
        for (let i = 0; i < beats; i++) at(t0 + i * spb, () => setRecCount(beats - i));
        at(t0 + beats * spb, () => {
            setRecCount(0);
            recorderRef.current = createRecorder();
            setElapsed(0);
            setRecording({ startedAt: Date.now() });
        });
    };
    const toggleRecording = () => {
        // カウント中に押したら録音をやめる
        if (recording?.counting) {
            clearRecCount();
            setRecording(null);
            return;
        }
        if (recorderRef.current) {
            const data = recorderRef.current.stop();
            recorderRef.current = null;
            setRecording(null);
            if (!data.notes.length) return;
            setRecordings((list) => {
                const now = Date.now();
                // 新しい録音は「まだ聴いていない」印をつけて一覧の先頭に入れる
                const next = [{ id: `${now}`, name: defaultName(now, list), createdAt: now, unheard: true, ...data }, ...list];
                if (!saveRecordings(next)) notifySaveFailed(tRef.current);
                return next;
            });
        } else startRecCount();
    };
    useEffect(() => {
        if (!recording || recording.counting) return undefined;
        const id = setInterval(() => setElapsed(recorderRef.current?.elapsed() ?? 0), 250);
        return () => clearInterval(id);
    }, [recording]);

    // 録音の再生(鍵盤も光る)
    const stopPlayback = useCallback(() => {
        playerRef.current?.stop();
        playerRef.current = null;
        setPlayingId(null);
    }, []);
    const play = (rec) => {
        stopPlayback();
        const sampler = samplerRef.current;
        if (!sampler) return;
        sampler.unlock();
        // 録音を聴いている間は、ループとメトロノームの音が重ならないよう止める
        quietForPlayback();
        setPlayingId(rec.id);
        // 聴いたので「まだ聴いていない」印を消す
        if (rec.unheard) updateRecordings(recordings.map((r) => (r.id === rec.id ? { ...r, unheard: false } : r)));
        playerRef.current = playRecording(sampler, rec, {
            onKey: lightKey,
            onEnd: () => {
                playerRef.current = null;
                setPlayingId(null);
            },
        });
    };
    useEffect(() => () => playerRef.current?.stop(), []);
    // 録音を MP3 / MIDI にして共有シートで渡す
    const shareRecording = (rec, format, onProgress) => {
        const s = settingsRef.current || {};
        return exportRecording(samplerRef.current, rec, format, {
            tempo: s.tempo,
            beats: s.beats,
            reverb: REVERB_LEVELS[s.reverb] ?? REVERB_LEVELS.mid,
            onProgress,
        });
    };
    const updateRecordings = (next) => {
        setRecordings(next);
        if (!saveRecordings(next)) notifySaveFailed(tRef.current);
    };

    // ループ(🔁)。メトロノームの小節に合わせて動く。押すたびに
    //   なし → カウント(4, 3, 2, 1) → 録音 → (小節の区切りで)録音を終えて待つ → カウント → くり返し再生 → 止める → …
    // 長押しで今のループを消して録り直す。ゴミ箱のボタンで消す
    const atAudio = (time, fn) => {
        const sampler = samplerRef.current;
        const id = setTimeout(() => {
            loopTimersRef.current.delete(id);
            fn();
        }, Math.max(0, (time - sampler.currentTime()) * 1000));
        loopTimersRef.current.add(id);
    };
    const clearLoopTimers = () => {
        loopTimersRef.current.forEach(clearTimeout);
        loopTimersRef.current.clear();
        setCountIn(0);
    };
    const stopLoopPlayer = () => {
        loopPlayerRef.current?.stop();
        loopPlayerRef.current = null;
        clearLoopTimers();
    };
    // t0 から1小節ぶん、拍ごとに 4, 3, 2, 1(3拍子なら 3, 2, 1)と表示し、終わったら then を呼ぶ
    const countBar = (t0, then) => {
        const m = metroRef.current;
        const beats = m.beats();
        const spb = m.secondsPerBeat();
        for (let i = 0; i < beats; i++) atAudio(t0 + i * spb, () => setCountIn(beats - i));
        atAudio(t0 + beats * spb, () => {
            setCountIn(0);
            then();
        });
    };
    // カウントのあと startAt からループを流す
    const playLoopAt = (startAt) => {
        const sampler = samplerRef.current;
        const loop = loopRef.current;
        if (!sampler || !loop) return;
        loopPlayerRef.current = playLoop(sampler, loop, {
            startAt,
            // 録音したときとテンポが変わっていたら、それに合わせて伸び縮みさせる
            scale: loop.tempo / metroRef.current.tempo(),
            softer: () => LOOP_SOFTER[settingsRef.current?.loopVolume] ?? LOOP_SOFTER.mid,
            onKey: lightLoopKey,
            // ● で録音しているときは、ループの音も一緒に録音する(メトロノームの音は入らない)
            onNote: (midi, velocity, pedal) => recorderRef.current?.noteOn(midi, velocity, pedal) ?? null,
        });
    };
    // 1小節数えてからループを流す
    const countInPlay = (t0) => {
        const m = metroRef.current;
        setLoopPhase('countdown');
        const start = t0 ?? m.start();
        playLoopAt(start + m.barSeconds());
        countBar(start, () => {
            setLoopRun((n) => n + 1);
            setLoopPhase('playing');
        });
    };
    // 録音を始める: 1小節数えて、次の小節の頭から録音する
    const armLoop = () => {
        const sampler = samplerRef.current;
        const m = metroRef.current;
        if (!sampler || !m) return;
        sampler.unlock();
        stopLoopPlayer();
        loopRef.current = null;
        loopEndingRef.current = false;
        setLoopPhase('countin');
        const t0 = m.start();
        const recStart = t0 + m.barSeconds();
        loopRecStartRef.current = recStart;
        loopRecRef.current = createLoopRecorder(() => sampler.currentTime(), recStart);
        setLoopBar(1);
        countBar(t0, () => setLoopPhase('recording'));
    };
    // 録音を終える。長さは一番近い小節の区切りにそろえる(区切りがまだ先なら、そこまで録音を続ける)
    const finishLoop = () => {
        const sampler = samplerRef.current;
        const m = metroRef.current;
        if (loopEndingRef.current) return;
        loopEndingRef.current = true;
        const bar = m.barSeconds();
        const recStart = loopRecStartRef.current;
        const bars = Math.max(1, Math.round((sampler.currentTime() - recStart) / bar));
        const end = recStart + bars * bar;
        const finalize = () => {
            loopEndingRef.current = false;
            const loop = loopRecRef.current?.stop(bars * bar);
            loopRecRef.current = null;
            if (!loop) {
                setLoopPhase('idle');
                return;
            }
            loopRef.current = { ...loop, tempo: m.tempo() };
            // すぐには流さず止めた状態で待つ(もう一度 🔁 を押すと、数えてから流れる)
            setLoopPhase('paused');
        };
        if (end > sampler.currentTime()) atAudio(end, finalize);
        else finalize();
    };
    // 今のループを消す
    const deleteLoop = () => {
        stopLoopPlayer();
        loopRef.current = null;
        loopRecRef.current = null;
        loopEndingRef.current = false;
        setLoopPhase('idle');
    };
    // 録音を再生するときに呼ぶ。流れているループは止め(🔁 でまた流せる)、数えている途中なら取りやめ、
    // 録音中ならそこまでで録音を終える。メトロノームの音も消す(ループの録音中は音を出さずに拍だけ数え続ける)
    const quietForPlayback = () => {
        const phase = loopPhaseRef.current;
        if (phase === 'playing' || phase === 'countdown') {
            stopLoopPlayer();
            setLoopPhase('paused');
        } else if (phase === 'countin') deleteLoop();
        else if (phase === 'recording') finishLoop();
        metroAutoRef.current = false;
        if (metroOnRef.current) setMetroOn(false);
    };
    const tapLoop = () => {
        const phase = loopPhaseRef.current;
        if (phase === 'idle') armLoop();
        else if (phase === 'countin') deleteLoop();
        else if (phase === 'recording') finishLoop();
        else if (phase === 'playing' || phase === 'countdown') {
            stopLoopPlayer();
            setLoopPhase('paused');
        } else if (phase === 'paused') {
            samplerRef.current?.unlock();
            countInPlay();
        }
    };
    // 長押しの判定(🔁 とメトロノームのボタンで使う)
    const useLongPress = (onLong, onTap) => {
        const ref = useRef({ timer: null, fired: false });
        const end = () => clearTimeout(ref.current.timer);
        return {
            onPointerDown: () => {
                ref.current.fired = false;
                clearTimeout(ref.current.timer);
                ref.current.timer = setTimeout(() => {
                    ref.current.fired = true;
                    onLong();
                }, LONG_PRESS_MS);
            },
            onPointerUp: end,
            onPointerLeave: end,
            onPointerCancel: end,
            onContextMenu: (e) => e.preventDefault(),
            // 長押ししたときは、指を離したときのクリックは無視する
            onClick: () => {
                if (ref.current.fired) {
                    ref.current.fired = false;
                    return;
                }
                onTap();
            },
        };
    };
    const loopPress = useLongPress(armLoop, tapLoop);
    // メトロノーム: 押すと ON/OFF、長押しでテンポと拍子の調整
    const toggleMetro = () => {
        samplerRef.current?.unlock();
        metroAutoRef.current = false;
        setMetroOn(!metroOnRef.current);
    };
    const metroPress = useLongPress(() => setMetroPanel(true), toggleMetro);
    useEffect(() => {
        if (loopPhase !== 'recording') return undefined;
        const id = setInterval(() => {
            const sampler = samplerRef.current;
            const m = metroRef.current;
            if (!sampler || !m) return;
            setLoopBar(Math.floor((sampler.currentTime() - loopRecStartRef.current) / m.barSeconds()) + 1);
        }, 100);
        return () => clearInterval(id);
    }, [loopPhase]);
    useEffect(
        () => () => {
            loopPlayerRef.current?.stop();
            loopTimersRef.current.forEach(clearTimeout);
        },
        []
    );
    const hasLoop = ['countdown', 'playing', 'paused'].includes(loopPhase);
    // タイムラインに出すループ(今のテンポに合わせた秒)。流す前のカウント中と流している間だけ
    const showTimeline = loopPhase === 'playing' || loopPhase === 'countdown';
    const currentLoop = loopRef.current;
    const loopTimeline = useMemo(() => {
        if (!currentLoop || !showTimeline) return null;
        const scale = currentLoop.tempo / (settings?.tempo || currentLoop.tempo);
        return { length: currentLoop.length * scale, notes: currentLoop.notes.map((n) => ({ ...n, t: n.t * scale, d: n.d * scale })) };
    }, [currentLoop, showTimeline, settings?.tempo]);
    // ループが動いている間はテンポと拍子を変えない(ループの長さがずれるため)
    const tempoLocked = LOOP_ACTIVE.has(loopPhase);

    // オプション設定の変更。音量と響きはすぐに音へ反映し、端末に保存する
    const changeSettings = (value) => {
        const prev = settingsRef.current;
        // ループが動いている間はテンポと拍子を変えない
        const next = LOOP_ACTIVE.has(loopPhaseRef.current) ? { ...value, tempo: prev.tempo, beats: prev.beats } : value;
        settingsRef.current = next;
        setSettingsState(next);
        saveSettings(next);
        // ペダルを外したら、のばしていた音を止める
        if (!next.sustain && sustainedRef.current.length) {
            sustainedRef.current.forEach(([, stop]) => stop());
            sustainedRef.current = [];
        }
    };
    useEffect(() => {
        const sampler = samplerRef.current;
        if (!sampler || !settings) return;
        sampler.setVolume(settings.volume / 100);
        sampler.setReverb(REVERB_LEVELS[settings.reverb] ?? REVERB_LEVELS.mid);
        metroRef.current?.setTempo(settings.tempo);
        metroRef.current?.setBeats(settings.beats);
    }, [settings]);
    const unheard = countUnheard(recordings);

    const toggleRows = () => {
        const two = !twoRows;
        setTwoRows(two);
        try {
            localStorage.setItem(ROWS_PREF_KEY, two ? '2' : '1');
        } catch {
            // 保存できない環境ではそのまま
        }
        // 2段にしたとき、上の段は下の段のすぐ右隣から始める
        if (two && viewRef.current) setView((v) => ({ ...v, upperStart: v.start + v.count }));
    };

    // 鍵盤の並び(拡大率が変わったときだけ作り直す)
    const rows = twoRows ? ['upperStart', 'start'] : ['start']; // 上の段が先(画面の上)
    const space = view && width ? width / view.count : 0;
    const gap = keyGap(space);
    // 段の高さの上限(大きな画面だけ Piano.module.css で使う)。拡大縮小では変えないよう、最初の拡大率の鍵盤の幅で決める
    const rowMax = width ? (ROW_MAX_RATIO * width) / Math.max(MIN_COUNT, Math.min(MAX_COUNT, width / 56)) : 0;
    const rowHeight = twoRows ? (height - 6) / 2 : height; // 段の間は 6px(Piano.module.css の .rows の gap)
    const labels = settings?.labels ?? 'c';
    const pcHints = settings?.pcHints ?? true;
    const noteStyle = settings?.noteStyle ?? 'abc';
    // 言語(設定を読み込むまでは日本語。静的に書き出したHTMLと最初の描画を合わせるため)
    const lang = settings ? resolveLang(settings.lang) : 'ja';
    const t = makeT(lang);
    tRef.current = t;
    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);
    const showLabel = (k) => !k.black && (labels === 'all' || (labels === 'c' && k.midi % 12 === 0));
    // 鍵の要素を覚えておく関数(段と鍵ごとに1つだけ作って使い回す。毎回作ると、変わっていない鍵まで描き直しになる)
    const keyRefsRef = useRef(new Map());
    const keyRef = (row, midi) => {
        const id = `${row}:${midi}`;
        let fn = keyRefsRef.current.get(id);
        if (!fn) {
            fn = (el) => {
                const map = keyElsRef.current;
                if (!map.has(midi)) map.set(midi, new Set());
                const set = map.get(midi);
                const prev = set.byRow?.[row];
                if (prev) set.delete(prev);
                if (el) set.add(el);
                set.byRow = { ...set.byRow, [row]: el };
            };
            keyRefsRef.current.set(id, fn);
        }
        return fn;
    };
    const renderKeys = (row) => KEYS.map((k) => (
        <Key
            key={k.midi}
            elRef={keyRef(row, k.midi)}
            className={`key ${k.black ? 'black' : 'white'}${activeCountRef.current.has(k.midi) ? ' active' : ''}${loopCountRef.current.has(k.midi) ? ' loop' : ''}`}
            style={KEY_STYLES.get(k.midi)}
            label={showLabel(k) ? (noteStyle === 'doremi' ? solfegeName(k.midi, lang) : noteName(k.midi)) : null}
            hint={row === 0 && pcHints ? HINT_OF[k.midi - baseC] : null}
        />
    ));
    // 鍵の並びは、音名・ヒントの表示が変わったときだけ作り直す(拡大縮小・移動では作り直さない)
    const upperKeys = useMemo(() => (twoRows ? renderKeys(1) : null), [twoRows, labels, noteStyle, lang]); // eslint-disable-line react-hooks/exhaustive-deps
    const lowerKeys = useMemo(() => renderKeys(0), [baseC, labels, pcHints, noteStyle, lang]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <I18nProvider value={t}>
            <div className={styles.page}>
                <header className={styles.topbar}>
                    {/* ループを流している間は、全体図の代わりにループのタイムラインを出す */}
                    {loopTimeline ? (
                        <LoopTimeline
                            loop={loopTimeline}
                            beats={metroRef.current?.beats() ?? 4}
                            secondsPerBeat={metroRef.current?.secondsPerBeat() ?? 0.5}
                            position={() => loopPlayerRef.current?.position() ?? 0}
                        />
                    ) : (
                        view && <Minimap view={view} onChange={setView} minCount={MIN_COUNT} maxCount={MAX_COUNT} twoRows={!!twoRows} />
                    )}
                    <div className={styles.buttons}>
                        <button
                            type="button"
                            className={`${styles.button} ${recording ? styles.recording : ''}`}
                            onClick={toggleRecording}
                            aria-label={t(recording?.counting ? 'rec.cancel' : recording ? 'rec.stop' : 'rec.start')}
                        >
                            {recording ? <span className={styles.stopIcon} /> : <span className={styles.recIcon} />}
                            {recording?.counting && recCount > 0 && <span className={styles.recTime}>{recCount}</span>}
                            {recording && !recording.counting && <span className={styles.recTime}>{formatDuration(elapsed)}</span>}
                        </button>
                        {/* メトロノーム: 押すと ON/OFF、長押しでテンポと拍子 */}
                        <button
                            type="button"
                            ref={metroBtnRef}
                            className={`${styles.button} ${styles.pressButton} ${styles.metroButton} ${metroOn ? styles.metroOn : ''}`}
                            {...metroPress}
                            aria-label={t(metroOn ? 'metro.stop' : 'metro.start')}
                            aria-pressed={metroOn}
                        >
                            <Icon name="metronome" size={20} />
                            {metroOn && <span className={styles.recTime}>{settings?.tempo}</span>}
                        </button>
                        {/* ループ(🔁)と、ループがあるときの削除ボタンを1つの枠にまとめる */}
                        <div className={`${styles.group} ${hasLoop ? styles.groupWide : ''}`}>
                            <button
                                type="button"
                                className={`${styles.button} ${styles.groupButton} ${styles.pressButton} ${LOOP_CLASS[loopPhase] ? styles[LOOP_CLASS[loopPhase]] : ''}`}
                                {...loopPress}
                                aria-label={t(`loop.${loopPhase}`)}
                            >
                                <Icon name="repeat" size={20} />
                                {/* 録音中は何小節目か、カウント中は数字 */}
                                {loopPhase === 'recording' && <span className={styles.recTime}>{loopBar}</span>}
                                {(loopPhase === 'countin' || loopPhase === 'countdown') && countIn > 0 && (
                                    <span className={styles.recTime}>{countIn}</span>
                                )}
                                {/* ループの進み具合(1周で左から右へ) */}
                                {loopPhase === 'playing' && loopRef.current && (
                                    <span
                                        key={loopRun}
                                        className={styles.loopBar}
                                        style={{
                                            animationDuration: `${(loopRef.current.length * loopRef.current.tempo) / (settings?.tempo || loopRef.current.tempo)}s`,
                                        }}
                                    />
                                )}
                            </button>
                            {hasLoop && (
                                <button
                                    type="button"
                                    className={`${styles.button} ${styles.groupButton} ${styles.groupTrash}`}
                                    onClick={deleteLoop}
                                    aria-label={t('loop.delete')}
                                >
                                    <Icon name="trash-2" size={18} />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            className={styles.button}
                            onClick={toggleRows}
                            aria-label={t(twoRows ? 'rows.one' : 'rows.two')}
                        >
                            <Icon name={twoRows ? 'rows-2' : 'rectangle-horizontal'} size={20} />
                            <span className={styles.rowsLabel}>{twoRows ? '2' : '1'}</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.button} ${menuOpen ? styles.on : ''}`}
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={t('menu')}
                        >
                            <Icon name="menu" size={22} />
                            {/* まだ聴いていない録音があるときの印 */}
                            {unheard > 0 && <span className={styles.dot} />}
                        </button>
                    </div>
                    {/* 言語が決まるまで(設定を読み込むまで)は出さない */}
                    {soundStatus !== 'ready' && settings && (
                        <span className={styles.status}>
                            {t(soundStatus === 'loading' ? 'status.loading' : 'status.synth')}
                        </span>
                    )}
                </header>

                {menuOpen && (
                    <Menu
                        unheard={unheard}
                        recordingsProps={{
                            recordings,
                            playingId,
                            onPlay: play,
                            onStop: stopPlayback,
                            onChange: updateRecordings,
                            onShare: shareRecording,
                        }}
                        settings={settings}
                        onSettingsChange={changeSettings}
                        tempoLocked={tempoLocked}
                        onClose={() => setMenuOpen(false)}
                    />
                )}

                {metroPanel && settings && (
                    <MetronomePanel
                        tempo={settings.tempo}
                        beats={settings.beats}
                        locked={tempoLocked}
                        onChange={(patch) => changeSettings({ ...settingsRef.current, ...patch })}
                        onClose={() => setMetroPanel(false)}
                    />
                )}

                {/* ループが流れ始める前のカウントダウン(鍵盤の上に大きく出す。鍵盤の操作はさまたげない) */}
                {(countIn > 0 || recCount > 0) && (
                    <div className={`${styles.countIn} ${countIn > 0 ? '' : styles.countRec}`} aria-live="polite">
                        <span key={countIn || recCount}>{countIn || recCount}</span>
                    </div>
                )}

                <div
                    className={`${styles.rows} ${twoRows ? '' : styles.single}`}
                    ref={rowsRef}
                    style={rowMax ? { '--row-max': `${rowMax}px` } : undefined}
                >
                    {rows.map((key, i) => (
                        <div
                            key={key}
                            className={styles.viewport}
                            ref={(el) => {
                                rowElsRef.current[i] = { el, key };
                                rowElsRef.current.length = rows.length;
                                rowRectsRef.current = null;
                            }}
                        >
                            {space > 0 && (
                                <div
                                    className={styles.keyboard}
                                    style={{
                                        width: WHITE_COUNT * space,
                                        transform: `translateX(${-view[key] * space}px)`,
                                        fontSize: `${keyEm(space, rowHeight)}px`,
                                        '--gap': `${gap}px`,
                                        '--space': `${space}px`,
                                        '--black-h': `${blackBottom(space, rowHeight, view.count)}px`,
                                    }}
                                >
                                    {key === 'upperStart' ? upperKeys : lowerKeys}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </I18nProvider>
    );
}
