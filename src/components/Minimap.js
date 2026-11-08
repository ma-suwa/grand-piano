"use client";

import { memo, useEffect, useRef } from 'react';
import { BLACK_AT_BOUNDARY, WHITE_COUNT } from '@/lib/keys';
import styles from './Minimap.module.css';

const EDGE_PX = 16; // 四角の端をつかんだと判定する幅(px)
const pct = (u) => `${(u / WHITE_COUNT) * 100}%`;

// 縮小図の鍵盤(変わらないので一度だけ描く。枠を動かすたびに作り直さない)
const MiniKeys = memo(function MiniKeys() {
    return (
        <>
            <div className={styles.whites}>
                {Array.from({ length: WHITE_COUNT }, (_, i) => <div key={i} className={styles.white} />)}
            </div>
            {[...BLACK_AT_BOUNDARY.keys()].map((b) => (
                <div key={b} className={styles.black} style={{ left: pct(b - 0.3), width: pct(0.6) }} />
            ))}
        </>
    );
});

// 88鍵の縮小図。青い四角が下の段(1段のときはその段)、オレンジの点線の四角が上の段に見えている範囲。
// - 四角の中をドラッグ: その四角を移動(青とオレンジは別々に動かせて、重ねてもよい)
// - 四角の左右の端をドラッグ: 広げる/狭める(2つの四角は常に同じ幅)
// - 2本指で広げる/つまむ: 指の近くの四角を中心に広げる/狭める
// - 四角の外をタップ: 近いほうの四角をそこへ移動
// view = { start, count, upperStart }(白鍵何個ぶんの位置か)
export default function Minimap({ view, onChange, minCount, maxCount = WHITE_COUNT, twoRows }) {
    const ref = useRef(null);
    const viewRef = useRef(view);
    viewRef.current = view;
    const drag = useRef(null);
    const touches = useRef(new Map()); // 縮小図に触れている指 -> x座標
    const pinch = useRef(null);

    useEffect(() => {
        const el = ref.current;
        // iPhoneで長押しの選択やスクロールが起きないようにする
        const stop = (e) => e.preventDefault();
        el.addEventListener('touchstart', stop, { passive: false });
        return () => el.removeEventListener('touchstart', stop);
    }, []);

    // 画面上のx座標 -> 白鍵何個ぶんの位置か
    const unitsAt = (clientX) => {
        const r = ref.current.getBoundingClientRect();
        return ((clientX - r.left) / r.width) * WHITE_COUNT;
    };

    // 今ある四角(key は view の中で位置を持つ項目名)
    const frames = () => {
        const v = viewRef.current;
        const list = [{ key: 'start', start: v.start }];
        if (twoRows) list.push({ key: 'upperStart', start: v.upperStart });
        return list;
    };
    const nearest = (u) => {
        const { count } = viewRef.current;
        return frames().reduce((a, b) => (Math.abs(u - (a.start + count / 2)) <= Math.abs(u - (b.start + count / 2)) ? a : b));
    };
    const setFrame = (key, start, count = viewRef.current.count) => onChange({ ...viewRef.current, [key]: start, count });

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        ref.current.setPointerCapture?.(e.pointerId);
        touches.current.set(e.pointerId, e.clientX);
        if (touches.current.size === 2) {
            // 2本目の指: ドラッグをやめてピンチにする
            const [a, b] = [...touches.current.values()];
            const mid = unitsAt((a + b) / 2);
            drag.current = null;
            pinch.current = { dist: Math.max(4, Math.abs(a - b)), mid, frame: nearest(mid).key, view: viewRef.current };
            return;
        }
        if (touches.current.size > 2 || pinch.current) return;

        const { count } = viewRef.current;
        const u = unitsAt(e.clientX);
        const edge = (EDGE_PX / ref.current.getBoundingClientRect().width) * WHITE_COUNT;
        const id = e.pointerId;
        // 端 > 中 の順に、近い四角を選ぶ
        const hits = frames().map((f) => ({
            ...f,
            left: Math.abs(u - f.start) < edge,
            right: Math.abs(u - (f.start + count)) < edge,
            inside: u > f.start && u < f.start + count,
            dist: Math.abs(u - (f.start + count / 2)),
        }));
        const byDist = (a, b) => a.dist - b.dist;
        const edgeHit = hits.filter((h) => h.left || h.right).sort(byDist)[0];
        const insideHit = hits.filter((h) => h.inside).sort(byDist)[0];
        if (edgeHit) {
            drag.current = { id, key: edgeHit.key, mode: edgeHit.left ? 'left' : 'right' };
        } else if (insideHit) {
            drag.current = { id, key: insideHit.key, mode: 'move', offset: u - insideHit.start };
        } else {
            // 四角の外: 近いほうの四角をそこが真ん中になるように移動して、そのままドラッグできる
            const f = nearest(u);
            drag.current = { id, key: f.key, mode: 'move', offset: count / 2 };
            setFrame(f.key, u - count / 2);
        }
    };

    const onPointerMove = (e) => {
        if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, e.clientX);
        const pz = pinch.current;
        if (pz && touches.current.size >= 2) {
            // 指の間隔に合わせて幅を変え、指の真ん中の動きに合わせて四角も動かす
            const [a, b] = [...touches.current.values()];
            const c = Math.max(minCount, Math.min(maxCount, (pz.view.count * Math.max(4, Math.abs(a - b))) / pz.dist));
            const center = pz.view[pz.frame] + pz.view.count / 2 + (unitsAt((a + b) / 2) - pz.mid);
            // もう一方の四角は、中心の位置を保ったまま幅だけ変える
            const other = pz.frame === 'start' ? 'upperStart' : 'start';
            const otherCenter = pz.view[other] + pz.view.count / 2;
            onChange({ ...viewRef.current, count: c, [pz.frame]: center - c / 2, [other]: otherCenter - c / 2 });
            return;
        }
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const v = viewRef.current;
        const u = unitsAt(e.clientX);
        const start = v[d.key];
        const end = start + v.count;
        if (d.mode === 'move') {
            setFrame(d.key, u - d.offset);
        } else {
            // 端をつかんだ四角の反対側の端は動かさない。もう一方の四角は中心を保って同じ幅にする
            const other = d.key === 'start' ? 'upperStart' : 'start';
            const otherCenter = v[other] + v.count / 2;
            let s = start;
            let c = v.count;
            if (d.mode === 'left') {
                s = Math.max(0, end - maxCount, Math.min(u, end - minCount));
                c = end - s;
            } else {
                c = Math.min(WHITE_COUNT, start + maxCount, Math.max(u, start + minCount)) - start;
            }
            onChange({ ...v, count: c, [d.key]: s, [other]: otherCenter - c / 2 });
        }
    };

    const onPointerUp = (e) => {
        touches.current.delete(e.pointerId);
        if (drag.current?.id === e.pointerId) drag.current = null;
        if (touches.current.size < 2) pinch.current = null;
    };

    return (
        <div
            ref={ref}
            className={styles.minimap}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <MiniKeys />
            <div className={styles.window} style={{ left: pct(view.start), width: pct(view.count) }}>
                <span className={styles.grip} />
                <span className={styles.grip} />
            </div>
            {twoRows && (
                <div className={styles.upperWindow} style={{ left: pct(view.upperStart), width: pct(view.count) }}>
                    <span className={styles.upperGrip} />
                    <span className={styles.upperGrip} />
                </div>
            )}
        </div>
    );
}
