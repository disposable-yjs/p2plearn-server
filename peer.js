/*
接続管理をPeerクラスに任せる。
接続管理をして、service.jsに渡す
*/
const io=require("engine.io-client")
const debug=require("debug")("peer:debug");
const crypt = require("./crypt")
const service=require("./service")

exports.Peer= class {
  constructor(){
    this._id="";
    this.cb=()=>{};
    this.disconnectCB=()=>{};//コールバック
    this.alive=false;
    this.socket=null;//これは子クラスに任せます。
    this.sentWhoAmI=false
    this.address=""
    this.registered=false
    this._connecting=false
  }
  set connecting(flag=false){
    if(!flag){
      this.disconnectCB()
    }
    this._connecting=flag;
  }
  onDisconnect(cb){
    this.disconnectCB=cb
  }
  sendMessage(verb,msg){}
  receiveMessage(cb){}
  disconnect(){
    this._id="";
    this.alive=false
  }
  getId(){
    return this._id
  }
  setId(id){
    this._id=id;
  }
  get id(){
    return this._id;
  }
  set id(v){
    this._id=v
  }
  //idと_idが混在しているコードがあったので、両方維持
  onReceived(cb){
    this.cb=cb
  }
  callReceived(msg){//復号して、onReceivedに設定したハンドラーにデータ渡す
    let d=null//データ
    crypt.decrypt(msg,service.manager.key).then(plain=>{//復号されたメッセージバッファ
      d=JSON.parse(plain.toString("utf8"))
      this.cb(d[0],d[1],this,true);
    }).catch(err=>{//改ざんor平文モード
      try{
        d=JSON.parse(msg)
        this.cb(d[0],d[1],this,false);
      }catch(e){
        debug("Failed to parse JSON.")
        this.cb(null,null,this,false);
      }
    })
    
  }
}
exports.ClientPeer= class extends exports.Peer {
  constructor(sock){
    super()
    this.socket=sock
    this.connecting=true
    this.socket.on("close",()=>{
      this.connecting=false;
    })
  }
  sendMessage(verb,msg){
    debug("cli send",[verb,msg],"to",this._id);
    const sendingBuf=Buffer.from(JSON.stringify([verb,msg]))
    crypt.encrypt(sendingBuf,this._id,service.manager.key).then(cipher=>{//暗号化
      this.socket.send(cipher);
    }).catch(err=>{
      this.socket.send(sendingBuf)
    })
  }
  
  disconnect(){
    super.disconnect()
    this.socket.disconnect()
  }
}
exports.ServerPeer= class extends exports.Peer{
  constructor(socket){
    super()
    
  }
  connect(address){
    this.address=address;
    this.socket=io(address);
    this.socket.on("open",()=>{
      this.connecting=true;
      this.socket.on("message",(data)=>{
        this.callReceived(data)
        debug("raw message:"+data)
      })
      debug("Client peer succeeded to connect to",address)
    });
    this.socket.on("error",()=>{
      this.connecting=false
    })
    this.socket.on("close",()=>{
      this.connecting=false;
    })
  }
  sendMessage(verb,msg){
    debug("svr send",[verb,msg],"to",this._id);
    const sendingBuf=Buffer.from(JSON.stringify([verb,msg]))
    crypt.encrypt(sendingBuf,this._id,service.manager.key).then(cipher=>{//暗号化
      this.socket.send(cipher);
    }).catch(err=>{
      this.socket.send(sendingBuf)
    })
  }
}

