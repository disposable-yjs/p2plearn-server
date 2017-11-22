const ServerPeer=require("./peer").ServerPeer
const service = require("./service")
const database=require("./database")
const debug = require("debug")("index:debug")
const info = require("debug")("index:info")
const crypt=require("./crypt.js")
const IS_NODE=typeof process === 'object' && process + '' === '[object process]';

class P2PManager{
  constructor(){
    this._myId;
  }
  setRSAKey(key){
    //key must be hex or Buffer
    
    if(typeof(key)==="string"){
      this.key=crypt.hex2buf(key)
    }else{
      this.key=key;
    }
    this._myId=crypt.getPubKeyB64(key)
  }
  beginService(address){
    let peer=null;
    if(address){
      peer=new ServerPeer()
      peer.connect(address)
    }
    service.beginService(peer,this)
  }
  seekData(dataId){
    return new Promise((resolve,reject)=>{
      let timeout=false
      service.sendAllPeer("seekData",{maxHop:15,idList:[this.myId],dataId})
      service.event.once("dataFound",(d)=>{
        if(timeout)return;
        resolve(d)
        timeout=true
      })
      setTimeout(()=>{
        if(timeout)return;
        timeout=true
        reject()
      },15000)
    }) 
  }
  get myId(){
    return this._myId
  }
  uploadFile(data){
    service.sendAllPeer("uploadFile",{
      description:data.description,
      tags:data.tags,
      requireMining:data.requireMining,
      body:data.body,
      name:data.name
    })
  }
  static createSearchCond(searchString){
    searchString=searchString.replace(/　/g," ")
    const splitted=searchString.split(" ")
    let cond={
      tags:[],//and
      userId:[],//or
      keyword:[]//or
    }//and
    splitted.forEach(v=>{
      switch(v[0]){
      case "#":
        cond.tags.push(v.slice(1))
        break
      case "@":
        cond.userId.push(v.slice(1))
        break
      default:
        cond.keyword.push(v)
      }
    })
    return cond;
    
    //#tag はOR検索
    //@userId はOR検索
    //その他のキーワードはOR検索
    //上記３つの条件はORです
  }
  search(searchCond){
    if(typeof searchCond=="string"){
      searchCond=P2PManager.createSearchCond(searchCond)
    }
    return new Promise((resolve,reject)=>{
      let timeout=false
      service.sendAllPeer("search",{maxHop:15,idList:[this.myId],searchCond})
      service.event.once("searchResult",(d)=>{
        if(timeout)return;
        resolve(d)
        timeout=true
      })
      setTimeout(()=>{
        if(timeout)return;
        timeout=true
        reject()
      },15000)
    }) 
  }
  sendChannelMessage(idList,data){
    service.myConnectionList[idList[1]].sendMessage("channelMessage",{idList,data})
    
  }
  sendReceiveChannelMessage(idList,data){
    let timeout=false
    return new Promise((resolve,reject)=>{
      service.myConnectionList[idList[1]].sendMessage("channelMessage",{idList,data})
      service.event.once("channelMessageReceived",(d)=>{
        if(timeout)return;
        resolve(d)
        timeout=true
      })
      setTimeout(()=>{
        if(timeout)return;
        timeout=true
        reject()
      },15000)
      
    })
  }
  updateUserProfile(screenName,profile,minerKey){
    debug(minerKey)
    return new Promise((resolve,reject)=>{
      service.sendAllPeer("updateUserProfile",{
        screenName,profile,minerKey
      })
      resolve()
    })
  }
  seekUser(id){
    return new Promise((resolve,reject)=>{
      let timeout=false
      service.sendAllPeer("seekUser",{maxHop:15,idList:[this.myId],id})
      service.event.once("userFound",(d)=>{
        if(timeout)return;
        resolve(d)
        timeout=true
      })
      setTimeout(()=>{
        if(timeout)return;
        timeout=true
        reject()
      },15000)
    }) 
  }
  addToCollection(dataId){
    return new Promise((resolve,reject)=>{

      service.sendAllPeer("addToCollection",{
        dataId
        
      })
    })
  }
  getCollection(){
    return new Promise((resolve,reject)=>{
      let timeout=false
      service.sendAllPeer("requestCollection",{maxHop:15,idList:[this.myId]})
      service.event.once("responseCollection",(d)=>{
        if(timeout)return;
        resolve(d.result)
        timeout=true
      })
      setTimeout(()=>{
        if(timeout)return;
        timeout=true
        reject()
      },15000)
    }) 
  }
  getConnections(){
    return this.sendReceiveChannelMessage([],{verb:"requestConnections"})
  }
}
P2PManager.RSA_BITS=512;
module.exports=P2PManager

//#if isNode 
if(IS_NODE){
  info("Node.js Detected")
  
  const config = require(process.argv[2]||"./config.node")
  const manager=new P2PManager()
  
  if(config.keyHex){
    manager.setKey(config.keyHex)
  }else if(config.seed){
    manager.setKey(crypt.hash(config.seed).slice(0,32))
  }else if(config.rawKey){
    manager.setKey(config.rawKey)
  }
  manager.beginService(config.defaultServer)
}
//#endif
//#if !isNode 
if(!IS_NODE){
  window.alert=console.log.bind(console)
}
//#endif










