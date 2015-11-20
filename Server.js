var express = require('express');
var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);
var fs = require('fs');

/* Bing translator initialization */
var mstranslator = require('mstranslator');
var traanslateWizard = new mstranslator({
	client_id: 'Super_ChatRoomWar_The1st',
	client_secret: 'pcXvlEef4+Xjb9ryikhhvxgjeX3XosHtud1rmnOm8jQ='
}, true);

/* system log initialization */ 
var userNumber = 0;
var logStream;
var logDir = './syslog/';
var logName;

/* express initialization */
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/public/Client.html');
});

server.listen(5092, '127.0.0.1', function() { console.log('listening on #: 5092'); });

function getDateTime() {
	var date = new Date();
	var hour = date.getHours();			hour = (hour < 10 ? "0" : "") + hour;    
    var min  = date.getMinutes();		min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();		sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;	month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();			day = (day < 10 ? "0" : "") + day;

    return year + month + day + '-' + hour + '-' + min + '-' + sec;
}

function initNewLog(){
	if (userNumber == 0) {
		logName = getDateTime() + '.csv';
		logStream = fs.createWriteStream(logDir + logName);
		logStream.write('User,Dialogue\n');
	}
}

io.on('connection', function(socket) {
	// the first event: if a user is linked to this server, open a dialogue box and input user ID
	socket.on('addMe', function(username) {
		socket.username = username;
		socket.emit('serverSelfMsg', '[SERVER] You have connected');
		socket.broadcast.emit('serverOthersMsg', '[SERVER] ' + username + ' is on deck');

		// initNewLog();

		userNumber = userNumber + 1;
		console.log('usernumber = ' + userNumber);
	});

	// when someone is disconnect, print server information
	socket.on('disconnect', function() {
		if (socket.username != null){
			socket.broadcast.emit('serverOthersMsg', '[SERVER] ' + socket.username + ' has left');
			// logStream.end();
			
			userNumber = userNumber - 1;
			console.log('usernumber = ' + userNumber);
		}
	});

	// when the socket with tag 'chat message' is received, send socket with tag 'chat' to all the user
	socket.on('chat message', function(msg) {
		var sysTime = getDateTime();
		var content = {uid: socket.username, msg: msg, sysTime: sysTime};
		io.sockets.emit('chat', content);

		// var logMsg = socket.username + ',' + msg + '\n';
		// logStream.write(logMsg);
	});

	// Pass translate result from server
	socket.on('translate', function(input) {
		var params = {
			text: input.word,
			from: input.fromLanguage,
			to: input.toLanguage
		};

		traanslateWizard.translate(params, function(err, data) {
			// for now, just return to one user!
			// io.sockets.emit('is BINDED', {fromWord: input.word, toWord: data, timeStamp: input.timeStamp});
			io.sockets.emit('is BINDED', {fromWord: input.word, toWord: data, timeStamp: input.timeStamp});
			// console.log(input.word + data);
		});
	})
	socket.on('blockMsg', function(block) {
		socket.broadcast.emit('partnerMsgBlock', block);
	});

	socket.on('shareMsg', function(timeStamp) {
		socket.broadcast.emit('partnerMsgShare', timeStamp);
	});

	socket.on('likeMsg', function(timeStamp) {
		socket.broadcast.emit('partnerMsgLike', timeStamp);
	});

	socket.on('dislikeMsg', function(timeStamp) {
		socket.broadcast.emit('partnerMsgDislike', timeStamp);
	});

});

