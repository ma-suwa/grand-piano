"use client";

import { memo } from 'react';

// 1つの鍵盤の見た目だけ。押す・離すの判定は鍵盤全体(Piano.js)でまとめて行う。
// ボタン要素にするとiPhoneでフォーカスや選択の表示が出るので、ただの div にしている
function Key({ elRef, className, style, hint, label }) {
    return (
        <div ref={elRef} className={className} style={style}>
            {label && <span className="key-c-label">{label}</span>}
            {hint && <span className="key-hint">{hint}</span>}
        </div>
    );
}

export default memo(Key);
