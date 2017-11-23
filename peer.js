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
    this.commonKey=null
    this.isKeyPublic=false
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
  get idB64(){
    return this._idB64;
  }
  set id(v){
    this._id=Buffer.from(v,"base64")
    this._idB64=v
  }
  //idと_idが混在しているコードがあったので、両方維持
  onReceived(cb){
    this.cb=cb
  }
  callReceived(rawMsg){//復号して、onReceivedに設定したハンドラーにデータ渡す。msgはString
    debug("Received:",rawMsg,this.id,this.commonKey)
    
    if(typeof rawMsg!=="string"){
      throw new TypeError("Message is not a string.")
    }
    
    let message={}
    let d=null //データ

    if(rawMsg[1]!=="@"){
      debug("this is not a correct message")
      return
    }
    const msg=rawMsg.slice(2)
    switch(rawMsg[0]|0){
      case crypt.mode.COMMON:
        //共通鍵モード
        debug("decrypting in common")
        crypt.decryptCommon(Buffer.from(msg,"base64"),this.commonKey).then(plain=>{
          debug("Plain text in receive common:",plain.toString())
          d=JSON.parse(plain.toString())
          this.cb(d[0],d[1],this,crypt.mode.COMMON);
        })
        break
      case crypt.mode.PUBLIC:
        //公開鍵モード
        debug("decrypting in pub")
        const cipherData = JSON.parse(msg)
        crypt.decryptPub({
          iv:Buffer.from(cipherData.iv,"base64"),
          ephemPublicKey:Buffer.from(cipherData.ephemPublicKey,"base64"),
          ciphertext:Buffer.from(cipherData.ciphertext,"base64"),
          mac:Buffer.from(cipherData.mac,"base64")
        },service.manager.key).then(plain=>{
          debug("Plain text in recv pub:",plain.toString())
          d=JSON.parse(plain.toString())
          this.cb(d[0],d[1],this,crypt.mode.PUBLIC);
        })
        break;
      case crypt.mode.PLAIN:
        //平文モード
        d=JSON.parse(msg)
        this.cb(d[0],d[1],this,crypt.mode.PLAIN);
        break
    }
    
  }

  sendMessage(verb,msg){
    debug("Sending:",[verb,msg])
    const sendingBuf=JSON.stringify([verb,msg])
    if(this.commonKey){
      debug("encrypting in common")
      crypt.encryptCommon(Buffer.from(sendingBuf),this.commonKey).then(cipher=>{
        debug("Cipher:",cipher.toString("base64"))
        this.socket.send(crypt.mode.COMMON+"@"+cipher.toString("base64"))
      })
    }else if(this.id){
      debug("encrypting in Pub")
      crypt.encryptPub(Buffer.from(sendingBuf),this.id).then(cipher=>{
        this.socket.send(crypt.mode.PUBLIC+"@"+JSON.stringify({
          iv:cipher.iv.toString("base64"),
          ephemPublicKey:cipher.ephemPublicKey.toString("base64"),
          ciphertext:cipher.ciphertext.toString("base64"),
          mac:cipher.mac.toString("base64")
        }));
      })
    }else{
      this.socket.send(crypt.mode.PLAIN+"@"+sendingBuf)
    }
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
}

