/*
接続管理をPeerクラスに任せる。
接続管理をして、service.jsに渡す
*/
const io=require("engine.io-client")
const debug=require("debug")("peer:debug");
const cryptico = require("cryptico")
const Base64 = require('js-base64').Base64;

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
    const r=cryptico.decrypt(msg,service.manager.key)//復号されたメッセージ
    if(r.status==="success"&&r.publicKeyString===this.id){
      d=JSON.parse(Base64.decode(r.plaintext))
      
    }else{
      debug("decrypt error!!!!Falling",r)
      try{
        d=JSON.parse(Base64.decode(msg))//鍵を交換する前など、暗号化されていない場合の処理。
      }catch(e){
        debug("Base64 result",Base64.decode(msg))
        debug("Failed to parse JSON or decode Base64.")
      }
    }
    this.cb(d[0],d[1],this,r.signature);
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
    const jsn=Base64.encode(JSON.stringify([verb,msg]))//Base64されたJson
    const r=cryptico.encrypt(jsn,this._id,service.manager.key)//暗号化
    if(r.status==="success"){
      
      this.socket.send(r.cipher);
    }else{
      debug("Encrypt Error!!!Falling")//鍵を交換する前など、暗号化されていない場合の処理。
      this.socket.send(jsn)
    }

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
    const jsn=Base64.encode(JSON.stringify([verb,msg]))
    const r=cryptico.encrypt(jsn,this._id,service.manager.key)
    if(r.status==="success"){
    
      this.socket.send(r.cipher);
    }else{
      debug("Encrypt Error!!!Falling")
      this.socket.send(jsn)//鍵を交換する前など、暗号化されていない場合の処理。
    }
  }
}
const service=require("./service")
