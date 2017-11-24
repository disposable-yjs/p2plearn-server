const database=require("./database")
const service= require("./service")

module.exports.receiver=(receivedData,remoteId)=>new Promise((resolve,reject)=>{
  switch(receivedData.verb){
    case "requestContentInfo":{
      database.contentInfo(receivedData.dataId).then(res=>{
        resolve({verb:"responseContentInfo",result:res})
      }).catch(reject)
      break
    }
    case "requestContentBody":{
      database.contentBody(receivedData.dataId).then(res=>{
        resolve({verb:"responseContentBody",body:res,dataId:receivedData.dataId})
      }).catch(reject)
      break
    }
    case "requestConnections":{
      const connections = []
      for (let i in service.myConnectionList){
        const peer = service.myConnectionList[i]
        connections.push({
          id:peer.id,
          address:peer.address
        })
      }
      resolve({verb:"responseConnections",result:connections})
      break
    }
  }
})
/*
  基本的にchannelMessageは何でも送れる。
  ピア同士のE2Eな通信はchannelMessageで行う。
  それならばそのメッセイジにきちんとしたフォーマットは不可欠。
  それをここで定義する。
*/
