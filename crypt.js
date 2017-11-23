const eccrypto = require("eccrypto")
const crypto = require("crypto")
const debug=require("debug")("crypto:debug");

exports.getPubKeyB64=keyBuf=>eccrypto.getPublic(keyBuf).toString("base64")
exports.getPubKey=keyBuf=>eccrypto.getPublic(keyBuf)

exports.hash=data=>crypto.createHash("sha384").update(data).digest();

//plain are Buffer

exports.sign=(privKey,msg)=>eccrypto.sign(privKey,msg) //Returns Promise
exports.verify=(pubKey,msg,sig)=>eccrypto.verify(pubKey,msg,sig) //Returns Promise

exports.encryptPub=(plain,pubKey)=>eccrypto.encrypt(pubKey,plain) //Returns Promise
exports.decryptPub=(cipher,privKey)=>eccrypto.decrypt(privKey,cipher) //Returns Promise

exports.encryptCommon=(plain,key)=>new Promise((resolve,reject)=>{ //Returns Promise
  const d=crypto.createCipher('aes192', key)
  // d.update(plain)
  // return resolve(d.final())

  let encryptedBuf = []
  //d.setEncoding('binary') 
  d.on('readable', () => {
    const data = d.read();
    if (data)
      encryptedBuf.push(data)
  });
  d.on('end', () => {
    resolve(Buffer.concat(encryptedBuf))
  });
  let cur=0;
  while(cur<plain.length){
    d.write(plain.slice(cur,cur+30));
    cur+=30
  }
  d.end();
})
exports.decryptCommon=(cipher,key)=>new Promise((resolve,reject)=>{ //Returns Promise
  const d=crypto.createDecipher('aes192', key)

  // d.update(cipher);
  // resolve(d.final())
  // debug("cipher=",cipher)

  let decryptedBuf = [];
  //d.setEncoding('binary') 
  d.on('readable', () => {
    const data = d.read();
    if (data)
      decryptedBuf.push(data);
  });
  d.on('end', () => {
    resolve(Buffer.concat(decryptedBuf));
  });

  let cur=0;
  while(cur<cipher.length){
    d.write(cipher.slice(cur,cur+30));
    cur+=30
  }
  
  
  d.end();
})


exports.createCommonKey=()=>crypto.randomBytes(exports.commonKeyStrength)

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

exports.mode={
  COMMON:2,
  PUBLIC:1,
  PLAIN:0
}
exports.commonKeyStrength=16;
