'use client';

// Lucide のアイコン(https://lucide.dev, ISC License)。
// 使うものだけを lucide-static v0.460.0 から写している(パッケージを増やさないため)
const ICONS = {
    menu: [['line', { x1: 4, x2: 20, y1: 12, y2: 12 }], ['line', { x1: 4, x2: 20, y1: 6, y2: 6 }], ['line', { x1: 4, x2: 20, y1: 18, y2: 18 }]],
    mic: [
        ['path', { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' }],
        ['path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }],
        ['line', { x1: 12, x2: 12, y1: 19, y2: 22 }],
    ],
    'circle-help': [
        ['circle', { cx: 12, cy: 12, r: 10 }],
        ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
        ['path', { d: 'M12 17h.01' }],
    ],
    settings: [
        ['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }],
        ['circle', { cx: 12, cy: 12, r: 3 }],
    ],
    'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
    'chevron-left': [['path', { d: 'm15 18-6-6 6-6' }]],
    x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
    play: [['polygon', { points: '6 3 20 12 6 21 6 3' }]],
    square: [['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }]],
    circle: [['circle', { cx: 12, cy: 12, r: 10 }]],
    'trash-2': [
        ['path', { d: 'M3 6h18' }],
        ['path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }],
        ['path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }],
        ['line', { x1: 10, x2: 10, y1: 11, y2: 17 }],
        ['line', { x1: 14, x2: 14, y1: 11, y2: 17 }],
    ],
    'rows-2': [['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }], ['path', { d: 'M3 12h18' }]],
    'rectangle-horizontal': [['rect', { width: 20, height: 12, x: 2, y: 6, rx: 2 }]],
    // メトロノーム(Lucide にないので同じ線の太さ・角の丸めで描いたもの)
    metronome: [
        ['path', { d: 'M9.5 3h5l4.5 18H5z' }],
        ['path', { d: 'M7 16h10' }],
        ['path', { d: 'm12 16 6-11' }],
    ],
    share: [
        ['path', { d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' }],
        ['polyline', { points: '16 6 12 2 8 6' }],
        ['line', { x1: 12, x2: 12, y1: 2, y2: 15 }],
    ],
    repeat: [
        ['path', { d: 'm17 2 4 4-4 4' }],
        ['path', { d: 'M3 11v-1a4 4 0 0 1 4-4h14' }],
        ['path', { d: 'm7 22-4-4 4-4' }],
        ['path', { d: 'M21 13v1a4 4 0 0 1-4 4H3' }],
    ],
};

// name: 上の一覧の名前 / fill: 塗りつぶす色(再生・録音ボタンなど)
export default function Icon({ name, size = 20, strokeWidth = 2, fill = 'none', className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {ICONS[name].map(([Tag, attrs], i) => (
                <Tag key={i} {...attrs} />
            ))}
        </svg>
    );
}
