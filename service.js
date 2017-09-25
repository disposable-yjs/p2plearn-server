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

const IS_NODE=typeof process === 'object' && process + '' === '[object process]';

let serverInfo = ""
//#if isNode
const config = require(process.argv[2]||"./config.node")
serverInfo = config.myHostname+":"+config.listenPort
//#endif

const event=exports.event=new Emitter();
let myId="";
exports.beginService=(firstServerPeer,man)=>{//P2Pサービスを開始する。
  myId=man.myId;
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
      id:myId,
      conns,
      serverInfo
      
    })
    peer.sentWhoAmI=true
  }
  peer.onReceived(exports.receiveHandler)
  peer.onDisconnect(()=>{
    myConnectionList[peer.id]=null;
    event.emit("disconnected",{id:peer.id})
    if(peer.address){
      let addr=peer.address
      setTimeout(()=>{
        const p=new ServerPeer()
        p.connect(addr)
        p.onReceived(exports.receiveHandler)
      },6000)
    }
    delete myConnectionList[peer.id]
    
    
  })
}
exports.receiveHandler=(verb,data,peer,sig)=>{//P2PmanagerなどUI層から送られたデータはこのハンドラ側から見えず、データに対する返答がココで受信されるので、それはちゃんとUI層に受け渡そう。UIに渡すには、index.jsでイベントを定義して、ここからイベント送信
  debug("received",verb,data)//,peer)
  switch(verb){//パケットの動詞で条件分岐
    case "whoAmI":{//自分の公開鍵、ほかのノードの接続情報を返答する。
      if(!peer.sentWhoAmI){
        let conns=[]
        for(let i in myConnectionList){
          if(myConnectionList[i].address){
            conns.push(myConnectionList[i].address)
          }
        }
        peer.sendMessage('whoAmI',{
          id:myId,
          conns
        })
        peer.sentWhoAmI=true
      }
      peer.id=data.id
      if(data.serverInfo&&!peer.address){
        peer.address=data.serverInfo
      }
      exports.createConnections(data.conns)
      
      myConnectionList[peer.id]=peer
      
      break
    }
    case "seekData":{//データを探索し、保有者へのルートをトレースする
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myId)){
        return 
      }
      data.idList.push(myId)
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
      const index=data.idList.indexOf(myId)
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
      const index=data.idList.indexOf(myId)
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
      if(sig!="verified"){//本人確認
        debug("this message is not signed so this packet was disposed")
        return
      }
      let id="";
      const userId=peer.id;
      database.calcHash(data.body).then(hash=>{
        id=userId+"-"+hash;//データIDは公開鍵とデータのハッシュ値
        return database.saveUploadedFile(data,id,userId)
      })
      break
    }
    case "search":{
      const searchCond=data.searchCond
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myId)){
        return 
      }
      data.idList.push(myId)
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
      const index=data.idList.indexOf(myId)
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
      if(sig!="verified"){//本人確認
        debug("this message is not signed so this packet was disposed")
        return
      }
      database.updateUserProfile(peer.id,data.screenName,data.profile)
      break
      
    }
    case "seekUser":{
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myId)){
        return 
      }
      data.idList.push(myId)
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
      const index=data.idList.indexOf(myId)
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
      
      if(sig!="verified"){//本人確認
        debug("this message is "+sig+" so this packet was disposed")
        return
      }
      database.addToCollection(peer.id,data.dataId).then(()=>{
        
      }).catch(debug)
      break;
      
    case "requestCollection":{
      if(data.idList.length>=data.maxHop){
        return;
      }
      if(~data.idList.indexOf(myId)){
        return 
      }
      data.idList.push(myId)
      database.getCollection(peer.id).then(result=>{
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
      const index=data.idList.indexOf(myId)
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
