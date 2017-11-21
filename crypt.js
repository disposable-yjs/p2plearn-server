const eccrypto = require("eccrypto")
const crypto = require("crypto")
const debug=require("debug")("crypto:debug");

exports.getPubKeyB64=keyBuf=>eccrypto.getPublic(keyBuf).toString("base64")
exports.getPubKey=keyBuf=>eccrypto.getPublic(keyBuf)

exports.hash=data=>crypto.createHash("sha384").update(data).digest();

exports.sign=(privKey,msg)=>eccrypto.sign(privKey,msg) //Returns Promise
exports.verify=(pubKey,msg,sig)=>eccrypto.verify(pubKey,msg,sig) //Returns Promise

exports.encrypt=(plain,pubKey)=>eccrypto.encrypt(pubKey,plain) //Returns Promise
exports.decrypt=(cipher,privKey)=>eccrypto.decrypt(privKey,cipher) //Returns Promise

exports.encryptWithSig=(plain,rcptPubKey,privKey)=>{
  
}
exports.decryptWithSig=(cipher,privKey)=>{
  
}

function loadWordList() {
  return Promise.resolve(require("./bip39en.json"))
}

function indexFromSortedList(sortedArray,value){
  let left=0
  let right=sortedArray.length-1

  while(left<=right){
    const center=(left+((right-left)/2)|0)
    const centerVal=sortedArray[center]
    if(centerVal===value){
      return center
    }else if(centerVal<value){
      left = center+1
    }else{
      right = center-1
    }
    
  }
  return null
}

function arrayToWords(array){
  return loadWordList().then((wordList)=>{
    const words = []
    for(let i=0;i<13;i++){
      words.push(wordList[array[i]]);
    }
    return words
  })
}
function wordsToArray(words){
  return loadWordList().then((wordList)=>{
    const array = []
    for(let i=0;i<13;i++){
      const ret = indexFromSortedList(wordList,words[i])
      if(ret){
        array.push(ret)
      }else{
        return null
      }
    }
    return array;
  })

}

exports.indexFromSortedList=indexFromSortedList
exports.arrayToWords=arrayToWords
exports.wordsToArray=wordsToArray
exports.arrToBuffer32=(arr)=>{
  let str="";
  for(let i=0;i<arr.length;i++){
    str+=arr[i]+"|"
  }
  return exports.hash(str).slice(0,32)
}
exports.hex2buf=hex=>{}
