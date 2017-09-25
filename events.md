## seekData
data.js is given:
+ リクエスト経路のIDリスト
+ 最大のホップ数
+ お目当のデータID

behavior:
+ データIDを自分のDBから探す
+ あったら自分のIDを書き足してからdataFoundをリスト末尾のピアに送信
+ なかったら他のピアにseekDataを自分のIDを書き足して回す

## dataFound
data.js is given
+ リクエスト経路のIDリスト
+ お目当のデータID
behaviour:
+ 自分のIDを探して、その前のピアにパケットを中継送信

## requestData
given
+ データID
+ 経路

## responseData

behaviour:
+ 自分宛でなければ中継
+ データIDを頼りに探す
+ responseData

## whoami
+ my
+ connectionList

behaviour:
+ 送ったことなかったら送り返す
+ そのぴあを登録

## channelMessage
+ idList
+ data (should be encrypted)

behaviour
送信者IDがidList[0]受信者IDがidList[-1]
すなわちレスポンスを返したいときはひっくり返そうね。

## responseData
バイナリです。

## challenge
my ID
encrypted random data

## whoami
my ID
connectionList(Host&Port,if given)

## search
キーワード

## searchResult
他の返答系のbehaviourと同じ

## seekUser
ユーザID

## userFound
他の返答系のbehaviourと同じ

名前、プロフィール

全てのイベントはステートレスでなければならない。そうでなければ、多対多の通信に支障が出る。
