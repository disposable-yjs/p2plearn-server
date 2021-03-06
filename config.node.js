module.exports={
  defaultServer:"",
  //Peer address to which this server first connects
  seed:"hs;otndtmru,rtu,ryikuo.t",
  //Seed string to make a key and ID.Make it long and random
  //rawKey:Buffer.allocUnsafe(32),
  //keyBase64:"Base64=="
  listenPort:process.env.PORT||"33400",
  //Port number
  dbPath:"db/1.db",
  //SQLite DB Path
  myHostname:"https://learn-lang.herokuapp.com",
  //this server's hostname or public IPx.If your IP is dynamic IP , it is highly recommended that you use dynamic DNS service.
  ssl:false/*{
    key:"/etc/letsencrypt/live/xn--4gr220a.ga/privkey.pem",
    cert:"/etc/letsencrypt/live/xn--4gr220a.ga/cert.pem",
    ca:"/etc/letsencrypt/live/xn--4gr220a.ga/chain.pem"
    }*/
  //if you use SSL,set paths of keys.
}
