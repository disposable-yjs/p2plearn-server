# P2PLearn

P2PLearn は学生のためのP2Pネットワーク/アプリケーションです

特徴
* 分散型
* 安全
* ブラウザでも動く

## フルノードを動かす
1. このリポジトリをクローン
1. `$ cd path/to/p2plearn-server`
1. `$ npm install`
1. config.node.jsを編集
    * `seed`が初期値から変更されていることを確認してください。
1. `$ mkdir db`
1. `$ npm start`
    * `port`を1024未満に設定した場合、スーパーユーザで実行してください。

## ブラウザで動かす

https://github.com/yuki-js/p2plearn-web

## ライセンス
MIT
Copyright (c) 2017 yuki-js
