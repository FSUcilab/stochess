var express = require('express');

var queryLi = require('./js/queryLi.js');

var app = express();

app.use(express.static('js'));
app.use('/js', express.static(__dirname + '/js'));

app.get('/', function(req, res, next) {
  //index
  console.log("hiii")
  res.send("hiiii")
})
app.get('/queryli', function(req, res, next) {
  // enable CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  var query = req.query;
  console.log("query!", req.query)
  res.send("ok!")
})

 var port = 8888;
var server = app.listen(port, function () {
  var host = 'localhost'
  console.log('query server listening at http://%s:%s', host, port);
});


