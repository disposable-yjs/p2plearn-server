const openDatabase = require('websql');//ブラウザとNode.jsでコードを共有するために、廃止された技術、WebSQLを使用せざるを得なかった。
let db;
const debug=require("debug")("database:debug")
const md5=require("md5")

let dbPath ="db/default.db";

//#if isNode
const config = require(process.argv[2]||"./config.node")
dbPath=config.dbPath||"db/default.db"
//#endif

const sql=exports.sql=(sql,place,cb,erCb=e=>debug(e))=>{
  db.readTransaction((tx)=>{
    tx.executeSql(sql,place,cb,erCb)
  })
  
}
const wsql=exports.wsql=(sql,place,cb,erCb=e=>debug(e))=>{
  db.transaction((tx)=>{
    tx.executeSql(sql,place,cb,erCb)
  })
  
}
exports.sqls=(arr)=>{
  db.transaction(tx=>{
    arr.forEach(v=>{
      tx.executeSql(v[0],v[1],v[2],err=>{debug("error",err)})
    })
  })
}
exports.init=(dbp)=>{
  db=openDatabase(dbp,"1.0","DB","")
  exports.sqls([
    ["CREATE TABLE IF NOT EXISTS contents(id TEXT PRIMARY KEY UNIQUE NOT NULL, contentBody TEXT NOT NULL, dataSize INTEGER NOT NULL);"],
    ["CREATE TABLE IF NOT EXISTS user(id TEXT PRIMARY KEY UNIQUE NOT NULL, screenName TEXT NOT NULL default 'Anonymous', profile TEXT);"],
    [`CREATE TABLE IF NOT EXISTS contentInfo(
 id TEXT PRIMARY KEY UNIQUE NOT NULL,
 description TEXT default 'No description',
 userId TEXT NOT NULL,
 adInfo TEXT default '(function(){})()',
 other TEXT default '{}',
 downloadable BOOLEAN NOT NULL default true,
 cacheAllowed BOOLEAN NOT NULL default true,
 preferDevice INT default 7,
 name TEXT NOT NULL,
 dataType TEXT NOT NULL,
 tags TEXT NOT NULL,
 dataSize INTEGER NOT NULL);`],
    ["CREATE TABLE IF NOT EXISTS collection(user TEXT NOT NULL, dataId INT NOT NULL);"]
  ])
};
exports.init(dbPath)
exports.dataExists=dataId=>{
  return new Promise((resolve,reject)=>{
    sql("SELECT id from contents where id = ?;",[dataId],(tx,result)=>{
      resolve(!!result.rows.length);
    })
  })
}
exports.calcHash=(body)=>{

  return new Promise((resolve,reject)=>{
    resolve(md5(body));
  })
}

exports.saveUploadedFile=(file,id,userId)=>new Promise((resolve,reject)=>{
  debug([
    ["INSERT INTO contents VALUES (?,?,?)",[id,file.body,file.body.length]],
    ["INSERT INTO contentInfo VALUES (?,?,?,?,'{}',TRUE,TRUE,7,?,'application/x-octet-stream',?,?)",
     [id,file.description,userId,file.adInfo,file.name,file.tags,file.body.length]
    ]
  ])
  exports.sqls([
    ["INSERT INTO contents VALUES (?,?,?)",[id,file.body,file.body.length]],
    ["INSERT INTO contentInfo VALUES (?,?,?,?,'{}',1,1,7,?,'application/x-octet-stream',?,?)",
     [id,file.description,userId,file.adInfo,file.name,file.tags,file.body.length]
    ]
  ])
})

exports.search=(searchCond)=>new Promise((resolve,reject)=>{//命令をエスケープしていないのは危険であるが、プレースホルダではうまくいかなかったので仕方がない
  let stmt="SELECT id,userId,name,description FROM contentInfo WHERE ";
  searchCond.tags.forEach(v=>{
    stmt+='tags LIKE "%'+v+'%" OR '
  })
  searchCond.userId.forEach(v=>{
    stmt+='userId = "'+v+'" OR '
  })
  searchCond.keyword.forEach(v=>{
    stmt+='name LIKE "%'+v+'%" OR description LIKE "%'+v+'%" OR '
  })
  //SQL Injectionごめんね
  stmt=stmt.slice(0,-3)
  debug("Statement:",stmt)
  exports.sql(stmt,[],(tx,res)=>{
    const ret=[]
    for(let i=0;i<res.rows.length;i++){
      ret.push(res.rows.item(i));
    }
    resolve(ret)
  },reject)
})
exports.contentInfo=(id)=>new Promise((resolve,reject)=>{
  sql("SELECT contentInfo.id, description,userId,adInfo,other,downloadable,cacheAllowed,preferDevice,name,dataType,tags,dataSize,screenName FROM contentInfo left join user on contentInfo.userId = user.id where contentInfo.id=?",[id],(tx,res)=>{
    if(res.rows.length){
      resolve(res.rows.item(0))
    }else{
      resolve(null)
    }
  },reject)
})
exports.contentBody=(id)=>new Promise((resolve,reject)=>{
  sql("SELECT * FROM contents WHERE id=?",[id],(tx,res)=>{
    if(res.rows.length){
      resolve(res.rows.item(0).contentBody)
    }else{
      resolve(null)
    }
  },reject)
})
exports.updateUserProfile=(id,screenName,profile)=>new Promise((resolve,reject)=>{
  wsql("REPLACE INTO user VALUES (?,?,?)",[id,screenName,profile],(tx,res)=>{
    if(res.rows.length){
      resolve()
    }else{reject()}
  },reject)
})
exports.getUserProfile=(id)=>new Promise((resolve,reject)=>{
  sql("SELECT * FROM user WHERE id=?",[id],(tx,res)=>{
    if(res.rows.length){
      const i=res.rows.item(0)
      resolve(i)
    }else{
      resolve(false)
    }
  })
})
exports.addToCollection=(user,data)=>new Promise((resolve,reject)=>{
  sql("SELECT * FROM collection WHERE user=? AND dataId=?",[user,data],(tx,res)=>{
    if(res.rows.length){
      resolve(false)
      return
    }
    wsql("INSERT INTO collection VALUES (?,?)",[user,data],(tx,res)=>{
      resolve(true)
    },reject)
  },reject)
})
exports.getCollection=(userId)=>new Promise((resolve,reject)=>{
  sql('SELECT id,description,name FROM collection join contentInfo on collection.dataId = contentInfo.id where user=?;',[userId],(t,res)=>{
    const ret=[]
    for(let i=0;i<res.rows.length;i++){
      ret.push(res.rows.item(i));
    }
    resolve(ret)
  })
})

