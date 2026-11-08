'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import { useT } from '@/lib/i18n';
import { LICENSE_TEXTS } from '@/lib/licenses';
import styles from './HelpView.module.css';

// はじめて使う人向けの説明。見出しをタップすると開閉する(アコーディオン)。
// 説明には、その操作で使う画面のパーツだけを切り抜いた画像をつける(public/help/ にある画像)。
// 文中の {repeat} のような書き方は、そのボタンのアイコンに置きかえて表示する
//
// 画像: { img: ファイル名, w: 表示する幅(px), alt: 説明 }。画像は2倍の解像度で撮ってある
const SECTIONS_JA = [
    {
        title: '弾く',
        items: [
            { img: 'play', w: 150, alt: '押している鍵盤が暗くなっているところ' },
            '鍵盤をタップすると音が鳴ります。何本の指でも同時に押せます。押している鍵盤は少し暗くなります。',
            '押したまま指を横にすべらせると、なめらかに音が続きます(グリッサンド)。',
        ],
    },
    {
        title: '見える場所を変える',
        items: [
            { img: 'minimap', w: 340, alt: '上の全体図と青い枠' },
            '上の小さな鍵盤は88鍵の全体図です。青い枠が、いま見えている場所です。',
            '枠をドラッグするか、行きたい場所をタップすると移動します。鍵盤を2本指で左右にスワイプしても移動できます。',
        ],
    },
    {
        title: '鍵盤の大きさを変える',
        items: [
            { img: 'resize', w: 120, alt: '青い枠の右の端' },
            '枠の左右の端(太い線のところ)をドラッグするか、全体図の上で2本指を広げたり狭めたりします。',
            '枠を広げるほど、たくさんの鍵盤が小さく並びます。2オクターブから3オクターブまで変えられます。',
        ],
    },
    {
        title: '2段で弾く',
        items: [
            { img: 'rows-button', w: 64, alt: '段の切り替えボタン' },
            '段の切り替えボタンを押すと、鍵盤が上下2段になります。ボタンの数字は、いまの段の数です。',
            { img: 'rows', w: 340, alt: '全体図の青い枠とオレンジの枠' },
            '全体図のオレンジの枠が上の段、青い枠が下の段です。2つの枠は別々に動かせるので、右手と左手で離れた音域を弾けます。',
        ],
    },
    {
        title: '録音する',
        items: [
            { img: 'record', w: 73, alt: '録音中のボタン' },
            '{circle} を押すと、4, 3, 2, 1(3拍子なら 3, 2, 1)と数えたあと録音が始まります。録音中はボタンが赤くなり、時間が出ます。もう一度押すと止まって保存されます。',
            '録音は {menu} メニューの「録音した音源」で聴けます。まだ聴いていない録音には赤い丸がつきます。名前をタップすると名前を変えられます。',
        ],
    },
    {
        title: '録音を送る・保存する',
        items: [
            { img: 'recordings', w: 340, alt: '録音の共有ボタンと形式の選択' },
            '「録音した音源」で {share} を押し、MP3 か MIDI を選びます。AirDrop やメッセージで送ったり、「ファイル」に保存したりできます。',
            'MP3 はふつうの音声です。MIDI は「どの音をいつ弾いたか」のデータで、GarageBand などで開いて編集できます。',
        ],
    },
    {
        title: 'メトロノーム',
        items: [
            { img: 'metronome', w: 200, alt: 'メトロノームのテンポと拍子の設定' },
            '{metronome} を押すと鳴り、もう一度押すと止まります。',
            '{metronome} を長押しすると、テンポと拍子(3拍子・4拍子)を変えられます。{menu} メニューのオプションからも変えられます。メトロノームの音は録音には入りません。',
        ],
    },
    {
        title: 'ループで練習する',
        items: [
            '弾いたフレーズをくり返し流して、それに合わせて弾けます。たとえば左手の伴奏を流しながら、右手のメロディを練習できます。',
            '1. {repeat} を押すとメトロノームが鳴り、4, 3, 2, 1 と数えたあと、小節の頭からフレーズの録音が始まります。',
            '2. 弾き終わったら {repeat} をもう一度押します。一番近い小節の区切りで録音が終わります。',
            '3. もう一度 {repeat} を押すと、数えてからフレーズがくり返し流れます。流れている鍵盤はオレンジ色に光ります。',
            { img: 'loop-buttons', w: 84, alt: 'ループのボタンとゴミ箱のボタン' },
            '流れている間に {repeat} を押すと止まります。{repeat} を長押しすると録り直し、{trash-2} でフレーズを消せます。',
            { img: 'timeline', w: 340, alt: 'ループのタイムライン' },
            'ループを流している間は、上の全体図がタイムラインに変わります。オレンジの帯は音が鳴っている時間、すき間は鳴っていない時間です。白い線が今の位置です。',
            'ループを流しながら {circle} で録音すると、ループの音も一緒に録音されます。',
        ],
    },
    {
        title: '外付けキーボードで弾く',
        items: [
            { img: 'keyboard', w: 150, alt: '鍵盤に書かれたキーボードの文字' },
            'iPad などにキーボードをつなぐと、鍵盤に書かれた文字のキーで弾けます。A S D F G H J K が白鍵、W E T Y U が黒鍵です。',
            '← → キーで1オクターブずつ移動します。',
        ],
    },
    {
        title: '音が出ないとき',
        items: [
            '本体の音量を上げてから、鍵盤をもう一度タップしてください。',
            '{menu} メニューのオプションの「音量」も確認してください。',
        ],
    },
    {
        title: 'ライセンス',
        items: [
            'このアプリは次の音源・ソフトウェアを使っています。',
            'Salamander Grand Piano — Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)。モノラルにして圧縮するなど、加工して使っています。',
            'lamejs (@breezystack/lamejs 1.2.7) — LGPL-3.0 (https://github.com/shijinyu/lamejs)',
            'Lucide — ISC License (https://lucide.dev)',
            'Capacitor — MIT License (https://capacitorjs.com)',
            'Next.js — MIT License (https://nextjs.org)',
            'React — MIT License (https://react.dev)',
            'MP3 への変換に使っている lamejs は LGPL-3.0 です。lamejs のソースコードは上の場所から、lamejs と組み合わせているこのアプリの画面側のソースコードは https://github.com/ma-suwa/grand-piano から入手できます。',
            'ライセンスの全文(名前をタップすると開きます):',
            { licenses: true },
        ],
    },
];

// 英語版。文字が写っている画像(メトロノーム・録音の一覧)は英語の画面で撮ったもの(public/help/en/)
const SECTIONS_EN = [
    {
        title: 'Playing',
        items: [
            { img: 'play', w: 150, alt: 'A pressed key shown darker' },
            'Tap a key to play it. You can press as many keys at once as you like. Keys you are pressing turn slightly darker.',
            'Slide your finger sideways while pressing to play a smooth run of notes (glissando).',
        ],
    },
    {
        title: 'Moving around the keyboard',
        items: [
            { img: 'minimap', w: 340, alt: 'The overview at the top with a blue frame' },
            'The small keyboard at the top shows all 88 keys. The blue frame marks the part you can see now.',
            'Drag the frame, or tap where you want to go. You can also swipe left or right on the keys with two fingers.',
        ],
    },
    {
        title: 'Changing the key size',
        items: [
            { img: 'resize', w: 120, alt: 'The right edge of the blue frame' },
            'Drag the left or right edge of the frame (the thick line), or pinch with two fingers on the overview.',
            'The wider the frame, the more keys you see and the smaller they get. You can show between 2 and 3 octaves.',
        ],
    },
    {
        title: 'Playing on two rows',
        items: [
            { img: 'rows-button', w: 64, alt: 'The row button' },
            'Tap the row button to split the keyboard into two rows. The number on the button is the current number of rows.',
            { img: 'rows', w: 340, alt: 'The blue and orange frames on the overview' },
            'On the overview, the orange frame is the top row and the blue frame is the bottom row. You can move them separately, so each hand can play in a different range.',
        ],
    },
    {
        title: 'Recording',
        items: [
            { img: 'record', w: 73, alt: 'The record button while recording' },
            'Tap {circle} to count 4, 3, 2, 1 (3, 2, 1 in 3/4) and start recording. The button turns red and shows the time. Tap it again to stop and save.',
            'Open {menu} and choose Recordings to listen. New recordings have a red dot. Tap a name to rename it.',
        ],
    },
    {
        title: 'Sharing and saving recordings',
        items: [
            { img: 'en/recordings', w: 340, alt: 'The share button and format choices for a recording' },
            'In Recordings, tap {share} and choose MP3 or MIDI. You can send it with AirDrop or Messages, or save it to Files.',
            'MP3 is a regular audio file. MIDI records which notes you played and when, so you can open and edit it in apps like GarageBand.',
        ],
    },
    {
        title: 'Metronome',
        items: [
            { img: 'en/metronome', w: 200, alt: 'Metronome tempo and time signature settings' },
            'Tap {metronome} to start the metronome, and tap again to stop it.',
            'Press and hold {metronome} to change the tempo and time signature (3/4 or 4/4). You can also change them in Options in the {menu} menu. The metronome is not included in recordings.',
        ],
    },
    {
        title: 'Practicing with a loop',
        items: [
            'Record a phrase and have it repeat while you play along. For example, loop a left-hand accompaniment while you practice the right-hand melody.',
            '1. Tap {repeat}. The metronome counts 4, 3, 2, 1, and recording starts at the beginning of a bar.',
            '2. When you finish playing, tap {repeat} again. Recording ends at the nearest bar line.',
            '3. Tap {repeat} once more. After a count-in, the phrase plays over and over. Keys played by the loop light up orange.',
            { img: 'loop-buttons', w: 84, alt: 'The loop button and the trash button' },
            'Tap {repeat} while it plays to stop. Press and hold {repeat} to record again, or tap {trash-2} to delete the phrase.',
            { img: 'timeline', w: 340, alt: 'The loop timeline' },
            'While a loop plays, the overview at the top turns into a timeline. Orange bands show when notes are sounding, and gaps show silence. The white line is the current position.',
            'If you record with {circle} while a loop plays, the loop is recorded too.',
        ],
    },
    {
        title: 'Playing with an external keyboard',
        items: [
            { img: 'keyboard', w: 150, alt: 'Computer keyboard letters shown on the keys' },
            'Connect a keyboard to your iPad or other device and play using the letters shown on the keys. A S D F G H J K play the white keys, and W E T Y U play the black keys.',
            'Use the ← and → keys to move one octave at a time.',
        ],
    },
    {
        title: "If there's no sound",
        items: [
            'Turn up the volume on your device, then tap a key again.',
            'Also check Volume in Options in the {menu} menu.',
        ],
    },
    {
        title: 'Licenses',
        items: [
            'This app uses the following sounds and software.',
            'Salamander Grand Piano — Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). The samples have been modified (converted to mono and compressed).',
            'lamejs (@breezystack/lamejs 1.2.7) — LGPL-3.0 (https://github.com/shijinyu/lamejs)',
            'Lucide — ISC License (https://lucide.dev)',
            'Capacitor — MIT License (https://capacitorjs.com)',
            'Next.js — MIT License (https://nextjs.org)',
            'React — MIT License (https://react.dev)',
            'lamejs, used to make MP3 files, is licensed under LGPL-3.0. Its source code is available at the address above. The source code of this app\'s interface, which uses lamejs, is available at https://github.com/ma-suwa/grand-piano.',
            'Full license texts (tap a name to open):',
            { licenses: true },
        ],
    },
];

const SECTIONS = { ja: SECTIONS_JA, en: SECTIONS_EN };

// 文中の {アイコン名} をアイコンにする
const withIcons = (text) =>
    text.split(/(\{[\w-]+\})/).map((part, i) => {
        const m = part.match(/^\{([\w-]+)\}$/);
        if (!m) return part;
        const dot = m[1] === 'circle'; // 録音の赤い丸
        return (
            <span key={i} className={styles.inlineIcon} aria-hidden="true">
                <Icon name={m[1]} size={dot ? 11 : 14} fill={dot ? '#ff3b30' : 'none'} strokeWidth={dot ? 0 : 2} />
            </span>
        );
    });

export default function HelpView() {
    const t = useT();
    const sections = SECTIONS[t.lang] || SECTIONS_JA;
    const [open, setOpen] = useState(() => new Set());
    const sectionRefs = useRef({});
    const toggle = (title) => {
        const opening = !open.has(title);
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
        // 開いた項目の中身が見えるよう、見出しを上までスクロールする
        if (opening) {
            requestAnimationFrame(() =>
                sectionRefs.current[title]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            );
        }
    };

    return (
        <div className={styles.help}>
            {sections.map((s, si) => {
                const isOpen = open.has(s.title);
                const id = `help-${si}`;
                return (
                    <section
                        key={s.title}
                        ref={(el) => {
                            sectionRefs.current[s.title] = el;
                        }}
                        className={`${styles.section} ${isOpen ? styles.open : ''}`}>
                        <button
                            type="button"
                            className={styles.head}
                            onClick={() => toggle(s.title)}
                            aria-expanded={isOpen}
                            aria-controls={id}
                        >
                            <span>{s.title}</span>
                            <Icon name="chevron-right" size={16} className={styles.chevron} />
                        </button>
                        {isOpen && (
                            <div id={id} className={styles.body}>
                                {s.items.map((item, i) =>
                                    typeof item === 'string' ? (
                                        <p key={i} className={styles.text}>
                                            {withIcons(item)}
                                        </p>
                                    ) : item.licenses ? (
                                        <div key={i}>
                                            {LICENSE_TEXTS.map((l) => (
                                                <details key={l.name} className={styles.text}>
                                                    <summary>{l.name}</summary>
                                                    <pre
                                                        style={{
                                                            whiteSpace: 'pre-wrap',
                                                            overflowWrap: 'anywhere',
                                                            fontSize: 11,
                                                            lineHeight: 1.5,
                                                            opacity: 0.75,
                                                            fontFamily: 'ui-monospace, Menlo, monospace',
                                                            margin: '6px 0 0',
                                                        }}
                                                    >
                                                        {l.text}
                                                    </pre>
                                                </details>
                                            ))}
                                        </div>
                                    ) : (
                                        <img
                                            key={i}
                                            className={styles.image}
                                            src={`/help/${item.img}.webp`}
                                            alt={item.alt}
                                            style={{ width: item.w }}
                                            draggable={false}
                                        />
                                    ),
                                )}
                            </div>
                        )}
                    </section>
                );
            })}
            <p className={styles.credit}>{t('help.credit')}</p>
        </div>
    );
}
