var express = require('express');
var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);
var fs = require('fs');

var userInfo = JSON.parse(fs.readFileSync('UserFile', 'utf8'));
var hash = require('./pass').hash;

/* Bing translator initialization */
var mstranslator = require('mstranslator');
var config = JSON.parse(fs.readFileSync('./translatorConfig', 'utf8'));
var translateWizard = new mstranslator({
	client_id: config.cID,
	client_secret: config.secret
}, true);

/* system log initialization */ 
var userNumber = 0;
var postID = 0;
var logStream;
var logDir = './syslog/';
var logName;

var loginUsers = {};
var blocks = {};
var ctrlLock = {};
var rooms = ['room1', 'room2'];  // [TBD] wait for login function 

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

function authenticate(name, pass, fn) {
	var user = userInfo[name];
	if (user == null) return fn(new Error('Unregistered user!'));
	if (pass == user.pwd) return fn(null, user);
	else return fn(new Error('Wrong Password!'));
}

io.on('connection', function(socket) {
	socket.on('login', function(packet) {
		authenticate(packet.usr, packet.pwd, function(err, user) {
			// if (user) {
			if(true) {
				socket.username = packet.usr;
				socket.room = 'room1';
				loginUsers[packet.usr] = packet.usr;
				blocks[packet.usr] = false;
				socket.join('room1');

				socket.emit('userConfirm', packet.usr, 'room1');
				socket.emit('serverSelfMsg', '[SERVER] You have connected', 'room1');
				socket.broadcast.to('room1').emit('serverOthersMsg', '[SERVER] ' + packet.usr + ' has login');
				
				userNumber = userNumber + 1;
				console.log('usernumber = ' + userNumber);
			} else {
				socket.emit('loginError', err.toString());
			}
		});
	});

	// when someone is disconnect, print server information
	socket.on('disconnect', function() {
		if (socket.username != null){
			socket.broadcast.to('room1').emit('serverOthersMsg', '[SERVER] ' + socket.username + ' has left');
			// logStream.end();
			delete loginUsers[socket.username];

			userNumber = userNumber - 1;
			console.log('usernumber = ' + userNumber);
		}
	});

	// when the socket with tag 'chat message' is received, send socket with tag 'chat' to all the user
	socket.on('chat message', function(input) {
		var sysTime = getDateTime();
		var content = {
			uid: socket.username, 
			msg: input, 
			sysTime: sysTime, 
			pID: postID, 
			block: blocks[socket.username]
		};
		postID++;
		
		io.sockets.in(socket.room).emit('chat', content);

		// var logMsg = socket.username + ',' + msg + '\n';
		// logStream.write(logMsg);
	});

	// Pass translate result from server
	socket.on('translate', function(packet) {
		if (ctrlLock.hasOwnProperty(packet.pID)) {
			var params = { text: packet.word, from: packet.fromLanguage, to: packet.toLanguage };
			var result = { owner: packet.owner, fromWord: packet.word, toWord: null, pID: packet.pID };

			translateWizard.translate(params, function(err, data) {
				result.toWord = data;
				io.sockets.in(socket.room).emit('is BINDED', result);
			});	
		}
	});

	socket.on('ctrlLock', function(pID) {
		ctrlLock[pID] = true;

	});

	socket.on('ctrlUnlock', function(pID) {
		delete ctrlLock[pID];
	});

	socket.on('blockMsg', function(input) {
		blocks[socket.username] = input;
		socket.broadcast.to('room1').emit('partnerMsgBlock', input);
	});

	socket.on('shareMsg', function(pID) {
		socket.broadcast.to('room1').emit('partnerMsgShare', {pID: pID, blockInfo: blocks[socket.username]});
	});

	socket.on('unshareMsg', function(pID) {
		socket.broadcast.to('room1').emit('partnerMsgUnshare', {pID: pID, blockInfo: blocks[socket.username]});
	});

	socket.on('likeMsg', function(pID) {
		socket.broadcast.to('room1').emit('partnerMsgLike', pID);
	});

	socket.on('dislikeMsg', function(pID) {
		socket.broadcast.to('room1').emit('partnerMsgDislike', pID);
	});

	socket.on('revert', function(packet) {
		io.sockets.in(socket.room).emit('revertMsg', packet);
	});

});
