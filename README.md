# P2PLearn

P2P Learn is a P2P network/application for students.

Feature:
* Distributed
* Secure
* Runnable even on browser

## Running a full node
1. Clone this repository
1. `$ cd path/to/p2plearn-server`
1. `$ npm install`
1. Edit config.node.js
    * Make sure that `seed` is changed from initial value.
1. `$ mkdir db`
1. `$ npm start`
    * If you set `port` less than 1024,you must run as a superuser.

## Running on browser

https://github.com/yuki-js/p2plearn-web

## License
MIT
Copyright (c) 2017 yuki-js
