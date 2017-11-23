/*
P2Pのプロトコルを定義し、実際の処理を行う。
*/
//処理を引き継いだら非同期で行い、メインルーティンとは独立して行うという感じ

const ServerPeer=require("./peer").ServerPeer
const database=require("./database")
const debug=require("debug")("service:debug");
const channel = require("./channel")
const Emitter= require("eventemitter3")
const myConnectionList=exports.myConnectionList={}
const crypt = require("./crypt")

const IS_NODE=typeof process === 'object' && process + '' === '[object process]';

let serverInfo = ""
//#if isNode
const config = require(process.argv[2]||"./config.node")
serverInfo = config.myHostname+":"+config.listenPort
//#endif

const event=exports.event=new Emitter();
let myId="";
let myIdB64=""
exports.beginService=(firstServerPeer,man)=>{//P2Pサービスを開始する。
  myId=man.myId;
  myIdB64=myId.toString("base64")
  man.service=exports
  exports.manager=man;
  //#if isNode
  if(IS_NODE){
    require("./socket")
  }
  //#endif
  if(firstServerPeer){
    exports.newConnection(firstServerPeer,false)
  }
}
exports.newConnection=(peer,whoami=true)=>{//自分の公開鍵、ほかのノードの接続情報を共有する。
  if(whoami){
    let conns=[]
    for(let i in myConnectionList){
      if(myConnectionList[i].address){
        conns.push(myConnectionList[i].address)
      }
    }
    peer.sendMessage('whoAmI',{
      id:myIdB64,
      conns,
      serverInfo
      
    })
    peer.sentWhoAmI=true
  }
  peer.onReceived(exports.receiveHandler)
  peer.onDisconnect(()=>{
    myConnectionList[peer.idB64]=null;
    event.emit("disconnected",{id:peer.id})
    if(peer.address){
      let addr=peer.address
      setTimeout(()=>{
        const p=new ServerPeer()
        p.connect(addr)
        p.onReceived(exports.receiveHandler)
      },6000)
    }
    delete myConnectionList[peer.idB64]
    
    
  })
}
exports.receiveHandler=(verb,data,peer,encrypted)=>{//P2PmanagerなどUI層から送られたデータはこのハンドラ側から見えず、データに対する返答がココで受信されるので、それはちゃんとUI層に受け渡そう。UIに渡すには、index.jsでイベントを定義して、ここからイベント送信.encrypted==trueならば受信したピアとは安全に通信できている。
  debug("received command=",verb,data)//,peer)
  switch(verb){//パケットの動詞で条件分岐
    case "whoAmI":{//自分の公開鍵、ほかのノードの接続情報を返答する。
      peer.id=data.id
      if(!peer.sentWhoAmI){
        let conns=[]
        for(let i in myConnectionList){
          if(myConnectionList[i].address){
            conns.push(myConnectionList[i].address)
          }
        }
        const commonKey=crypt.createCommonKey()
        peer.sendMessage('whoAmI',{
          id:myIdB64,
          conns,
          commonKey:commonKey.toString("base64")
        })

        peer.commonKey=commonKey //自分のものを保存
        peer.sentWhoAmI=true
      }
      if(data.commonKey&&!peer.commonKey){
        peer.commonKey=Buffer.from(data.commonKey,"base64")//他人からのを保存
      }
      
      if(data.serverInfo&&!peer.address){
        peer.address=data.serverInfo
      }
      exports.createConnections(data.conns)
      
      myConnectionList[peer.idB64]=peer
      
      break
    }
    case "seekData":{//データを探索し、保有者へのルートをトレースする
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myIdB64)){
        return 
      }
      data.idList.push(myIdB64)
      database.dataExists(data.dataId).then(result=>{
        debug("data exist?-",result)
        if(result){
          const dest=data.idList[data.idList.length-2]
          myConnectionList[dest].sendMessage("dataFound",{
            idList:data.idList,
            dataId:data.dataId
          })
        }else{
          exports.sendAllPeer("seekData",{
            dataId:data.dataId,
            idList:data.idList,
            maxHop:data.maxHop
          },data.idList)
        }
      })
      break
    }
    case "dataFound":{//seekDataに対して、保有者のルートを元のルートを戻って返答する。
      const index=data.idList.indexOf(myIdB64)
      if(index==0){
        event.emit("dataFound",{idList:data.idList,dataId:data.dataId}) //私じゃない!
      }else if(index>0){
        debug("戻し中継します")
        myConnectionList[data.idList[index-1]].sendMessage("dataFound",{
          idList:data.idList,
          dataId:data.dataId
        })
      }
      break
    }
    case "channelMessage":{
      const index=data.idList.indexOf(myIdB64)
      if(index==0){
        //私が送信者であったことを示す

      }else if(index==data.idList.length-1){
        //私が受信者であったことを示す
        event.emit("channelMessageReceived",{idList:data.idList,data:data.data})
        channel.receiver(data.data,data.idList[0]).then(data2Send=>{//チャンネルを開いて、返答
          myConnectionList[data.idList[index-1]].sendMessage("channelMessage",{idList:data.idList.reverse(),data:data2Send})
        })
        
      }else if(index>0){
        //中継
        myConnectionList[data.idList[index+1]].sendMessage("channelMessage",{
          idList:data.idList,
          data:data.data
        })
      }
      break
    }
    case "uploadFile":{
      
      const userId = Buffer.from(data.userId,"base64")
      const dataHash=crypt.hash(data.body).slice(0,16)
      const metaHash=crypt.hash(JSON.stringify(data.metadata)).slice(0,16)
      const hash=Buffer.concat([dataHash,metaHash])
      const hashB64 = hash.toString("base64")
      crypt.verify(userId,hash,Buffer.from(data.signature,"base64"))
        .then(()=>{
          return database.dataExists(hashB64)
        })
        .then((exist)=>{
          if(exist){
            debug("already exists.")
            return null
          }
          
          exports.sendAllPeer("uploadFile",{
            metadata:data.metadata,
            body:data.body,
            signature:data.signature,
            userId:data.userId
          })
          
          return database.saveUploadedFile({
            description:data.metadata.description,
            tags:data.metadata.tags,
            requireMining:data.metadata.requireMining,
            body:data.body,
            name:data.metadata.name,
            signature:data.signature,
            userId:data.userId
          },hashB64,data.userId)//データIDにハッシュ値を使う
        }).catch(()=>{
          debug("upload verification failed")
        })
      
      break
    }
    case "search":{
      const searchCond=data.searchCond
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myIdB64)){
        return 
      }
      data.idList.push(myIdB64)
      database.search(searchCond).then(result=>{
        if(result.length){
          const dest=data.idList[data.idList.length-2]
          myConnectionList[dest].sendMessage("searchResult",{
            idList:data.idList,
            searchCond,
            result
          })
        }else{
          exports.sendAllPeer("search",{
            searchCond,
            idList:data.idList,
            maxHop:data.maxHop
          },data.idList)
        }
      })
      break
    }
    case "searchResult":{
      const index=data.idList.indexOf(myIdB64)
      if(index==0){
        event.emit("searchResult",{idList:data.idList,searchCond:data.searchCond,result:data.result})//私宛てなので、UIに返答
      }else if(index>0){
        myConnectionList[data.idList[index-1]].sendMessage("searchResult",{
          idList:data.idList,
          searchCond:data.searchCond,
          result:data.result
        })
      }
    }
      break
    case "updateUserProfile":{
      const dth={
        screenName:data.screenName,profile:data.profile,minerKey:data.minerKey
      }
      const userId = Buffer.from(data.userId,"base64")
      const dataHash=crypt.hash(JSON.stringify(dth)).slice(0,32)
      crypt.verify(userId,dataHash,Buffer.from(data.signature,"base64")).then(()=>{
        return database.getUserProfile(data.userId)
      }).then((result)=>{
        if(!result||result.screenName!==data.screenName||result.profile!==data.profile||result.minerKey!==data.minerKey){
          exports.sendAllPeer("updateUserProfile",{
            screenName:data.screenName,
            profile:data.profile,
            minerKey:data.minerKey,
            signature:data.signature,
            userId:data.userId
          })
          database.updateUserProfile(peer.idB64,data.screenName,data.profile,data.minerKey)
        }
      }).catch(()=>{
        debug("profile verification failed")
      })
      
      break
      
    }
    case "seekUser":{
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myIdB64)){
        return 
      }
      data.idList.push(myIdB64)
      database.getUserProfile(data.id).then(result=>{
        debug("data exist?-",result)
        if(result){
          const dest=data.idList[data.idList.length-2]
          myConnectionList[dest].sendMessage("userFound",{
            idList:data.idList,
            id:data.id,
            result
          })
        }else{
          exports.sendAllPeer("seekUser",{
            id:data.id,
            idList:data.idList,
            maxHop:data.maxHop
          },data.idList)
        }
      })
      break
    }
    case "userFound":{
      const index=data.idList.indexOf(myIdB64)
      if(index==0){
        event.emit("userFound",{idList:data.idList,id:data.id,result:data.result}) //私宛てなのでUIに返す
      }else if(index>0){
        debug("戻し中継します")
        myConnectionList[data.idList[index-1]].sendMessage("userFound",{
          idList:data.idList,
          id:data.id,
          result:data.result
        })
      }
    }
      break
    case "addToCollection":
      
      if(!encrypted){//本人確認
        debug("this message is not encrypted so this packet was disposed")
        return
      }
      database.addToCollection(peer.idB64,data.dataId).then(()=>{
        
      }).catch(debug)
      break;
      
    case "requestCollection":{
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myIdB64)){
        return 
      }
      data.idList.push(myIdB64)
      database.getCollection(peer.idB64).then(result=>{
        debug("data exist?-",result)
        if(result&&result.length){
          const dest=data.idList[data.idList.length-2]
          myConnectionList[dest].sendMessage("responseCollection",{
            idList:data.idList,
            id:data.id,
            result
          })
        }else{
          exports.sendAllPeer("responseCollection",{
            id:data.id,
            idList:data.idList,
            maxHop:data.maxHop
          },data.idList)
        }
      }).catch(debug)
      break
    }
    case "responseCollection":{
      const index=data.idList.indexOf(myIdB64)
      if(index==0){
        event.emit("responseCollection",{idList:data.idList,id:data.id,result:data.result}) //私宛て
      }else if(index>0){
        debug("戻し中継します")
        myConnectionList[data.idList[index-1]].sendMessage("responseCollection",{
          idList:data.idList,
          id:data.id,
          result:data.result
        })
      }
      
      break
    }
  }
}
exports.createConnections=connList=>{
  connList.forEach(v=>{
    if(!v){return}
    for(let kk in myConnectionList){
      if(myConnectionList[kk].address==v){
        return;
      }
    }
    const p=new ServerPeer()
    p.connect(v)
    p.onReceived(exports.receiveHandler)
  })
}
exports.sendAllPeer=(verb,data,excludeIdList=[])=>{//接続している全てにブロードキャスト
  debug("exc",excludeIdList)
  for(let cc in myConnectionList){
    if(~excludeIdList.indexOf(cc)){
      continue
    }
    myConnectionList[cc].sendMessage(verb,data)
  }
  
}
