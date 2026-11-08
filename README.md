# グランドピアノ / Grand Piano

iPhone・iPad 向けピアノアプリ「グランドピアノ」の画面側(Web 部分)のソースコードです。
This is the source code of the web (interface) part of the iPhone / iPad app "Grand Piano".

- サポート / Support: https://ma-suwa.github.io/grand-piano/
- プライバシーポリシー / Privacy Policy: https://ma-suwa.github.io/grand-piano/privacy.html

## なぜ公開しているか / Why this is published

MP3 への書き出しに [lamejs](https://github.com/shijinyu/lamejs)(`@breezystack/lamejs`)を使っています。lamejs は GNU LGPL v3.0 で配布されているため、利用者が lamejs を差し替えてアプリの画面部分を作り直せるよう、lamejs と組み合わせているこのソースコードを公開しています。

The app uses lamejs (`@breezystack/lamejs`) to create MP3 files. lamejs is licensed under the GNU LGPL v3.0, so the source code that is combined with it is published here, so that you can replace lamejs with a modified version and rebuild the interface.

## ビルド / Build

Node.js 20 以上 / Node.js 20 or later:

```bash
npm install
npm run build      # out/ に静的ファイルを書き出す / writes static files to out/
```

lamejs を差し替えるときは、`package.json` の `@breezystack/lamejs` を変更したもの(ローカルのフォルダなど)に向けてから `npm install` と `npm run build` を実行してください。`out/` の中身がアプリに入る画面部分です([Capacitor](https://capacitorjs.com) で iOS アプリに包んでいます)。

To use a modified lamejs, point `@breezystack/lamejs` in `package.json` to your version (for example a local folder), then run `npm install` and `npm run build`. The contents of `out/` are the interface that is bundled into the app (wrapped as an iOS app with [Capacitor](https://capacitorjs.com)).

## ライセンス / Licenses

- このアプリ独自のコード: © 2026 masuwa. All rights reserved.(LGPL が認める範囲での改変・再ビルドは自由です / Modifying and rebuilding as permitted by the LGPL is allowed)
- ピアノ音源 `public/samples/salamander/`: Salamander Grand Piano by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。モノラル化・圧縮して使用 / converted to mono and compressed
- lamejs: GNU LGPL v3.0
- Next.js, React, Capacitor: MIT License
- アイコン / Icons: [Lucide](https://lucide.dev), ISC License

各ライセンスの全文は `src/lib/licenses.js` にあり、アプリの「使い方 > ライセンス」でも読めます。
Full license texts are in `src/lib/licenses.js` and in the app under How to use > Licenses.
