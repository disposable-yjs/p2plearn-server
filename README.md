# P2PLearn

P2P Learn is a P2P network/application for students.

Feature:
* Decentralized
* Secure
* Runnable in browser

## Running a full node
1. Clone this repository
1. `$ cd path/to/p2plearn-server`
1. `$ npm install`
1. Edit config.node.js
    * Make sure that `seed` is changed from initial value.
1. `$ mkdir db`
1. `$ npm start`
    * If you set `port` less than 1024,run as a superuser.

## Running in browser

https://github.com/yuki-js/p2plearn-web

## License
MIT
Copyright (c) 2017 yuki-js
