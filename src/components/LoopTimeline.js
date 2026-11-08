'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';
import styles from './LoopTimeline.module.css';

const MIN_SOUND = 0.08; // とても短い音も見えるように、最低この長さ(秒)の帯にする

// 鳴っている時間をつなげて帯にする(和音や重なった音は1本にまとめる)。
// ループが変わったときだけ計算し、毎フレームは計算しない
const shapeCache = new WeakMap();
const shapesFor = (loop) => {
    let shapes = shapeCache.get(loop);
    if (shapes) return shapes;
    const sorted = [...loop.notes].sort((p, q) => p.t - q.t);
    const spans = [];
    sorted.forEach((n) => {
        const end = n.t + Math.max(n.d, MIN_SOUND);
        const last = spans[spans.length - 1];
        if (last && n.t <= last.end) last.end = Math.max(last.end, end);
        else spans.push({ start: n.t, end });
    });
    shapes = { sorted, spans };
    shapeCache.set(loop, shapes);
    return shapes;
};

// ループを流している間、上の全体図の代わりに出す細い帯のタイムライン。
// 横が時間(1周ぶん。小節と拍の線つき)。音の高さは出さず、音が鳴っている時間をオレンジの帯、
// 鳴っていない時間を暗いすき間で見せる。音の始まりには明るい線を引くので、続けて弾いた音も分かれて見える。
// 再生位置の線が左から右へ動き、いま鳴っている帯が明るくなる
// loop: { length, notes } (秒は今のテンポに合わせたもの) / beats: 1小節の拍の数 / secondsPerBeat: 1拍の長さ
// position(): 今ループの何秒目か
export default function LoopTimeline({ loop, beats, secondsPerBeat, position }) {
    const t = useT();
    const canvasRef = useRef(null);
    const propsRef = useRef(null);
    propsRef.current = { loop, beats, secondsPerBeat, position };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let raf = 0;

        const draw = () => {
            raf = requestAnimationFrame(draw);
            const { loop: lp, beats: bpb, secondsPerBeat: spb, position: pos } = propsRef.current;
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#141416';
            ctx.fillRect(0, 0, w, h);
            if (!lp || !lp.length) return;

            const x = (t) => (t / lp.length) * w;
            // 拍の線(小節の頭は太く明るく)
            const totalBeats = Math.round(lp.length / spb);
            for (let i = 0; i < totalBeats; i++) {
                const bx = Math.round(x(i * spb)) + 0.5;
                const isBar = i % bpb === 0;
                ctx.fillStyle = isBar ? '#55555e' : '#2a2a30';
                ctx.fillRect(bx - (isBar ? 0.5 : 0), 0, isBar ? 1.5 : 1, h);
            }

            const { sorted, spans } = shapesFor(lp);
            const now = pos();
            const pad = 3;
            const bh = h - pad * 2;
            spans.forEach((sp) => {
                const sx = x(sp.start);
                const sw = Math.max(2, Math.min(x(sp.end), w) - sx);
                const on = now >= sp.start && now < sp.end;
                ctx.fillStyle = on ? '#ffe2bd' : '#e8913a';
                ctx.fillRect(sx, pad, sw, bh);
            });
            // 音の始まり
            sorted.forEach((n) => {
                const on = now >= n.t && now < n.t + Math.max(n.d, MIN_SOUND);
                ctx.fillStyle = on ? '#ffffff' : '#ffd29a';
                ctx.fillRect(x(n.t), pad - 1, 1.5, bh + 2);
            });

            // 再生位置
            const px = Math.round(x(now)) + 0.5;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(0, 0, px, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px - 1, 0, 2, h);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div className={styles.timeline}>
            <canvas ref={canvasRef} className={styles.canvas} aria-label={t('loop.timeline')} />
        </div>
    );
}
