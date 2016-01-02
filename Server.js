/* Default lib initialization */
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var hash = require('./pass').hash;

/* System attribute initialization*/
var config = JSON.parse(fs.readFileSync('./config', 'utf8'));

/* Postgres database initialization*/
var pg = require('pg');
var dbLink = new pg.Client(config.DB);
dbLink.connect();

/* Bing Translator initialization */
var mstranslator = require('mstranslator');
var translateWizard = new mstranslator({ client_id: config.MT.cID, client_secret: config.MT.secret}, true);

/* system log initialization */ 
var userNumber = 0;
var postID = 0;
var loginUsers = {};
var ctrlLock = {};
var colorName = ['partnerA', 'partnerB', 'partnerC', 'partnerD', 'partnerE', 'partnerF'];

/* express ignite */
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/public/Client.html');
});

app.get('/signUp', function(req, res) {
	res.sendFile(__dirname + '/public/SignIn.html');
});

/* Server ignite */
server.listen(5092, '127.0.0.1', function() { console.log('Server Start! Listening on #: 5092'); });

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

function authenticate(name, pass, fn) { // add a condition check for "room" or "team"
	dbLink.query("SELECT * FROM userInfo WHERE uid = $1", [name], function(err, result) {
		if(err) fn(new Error('Query Problem!'));

		if (result.rows[0] == null) {
			return fn(new Error('Unregistered user!'));
		} else {
			hash(pass, result.rows[0].salt, function(err, cipher) {
				if (err) return fn(err);
				
				if (cipher.toString() == result.rows[0].pwd) return fn(null, {usr: name, room: result.rows[0].groupname});
				else return fn(new Error('Invalid password'));
			});
		}
	});
}

function colorCode (name) {
	var j = 0;
	for (var i = 0; i < name.length; i++) j = j + name.charCodeAt(i);
	return j % 6;
}

io.on('connection', function(socket) {
	socket.on('login', function(packet) { // there is a room name in packet now!
		authenticate(packet.usr, packet.pwd, function(err, user) {
			// if (user) {
			if (true) { //  any users are allowed!
				var temp = {userID: packet.usr, userColor: colorCode(packet.usr), blocks: false};
				socket.username = temp.userID;
				socket.room = 'room1'; 
				// socket.room = user.group;
				loginUsers[temp.userID] = temp;
				
				socket.join('room1'); 
				// socket.join(user.group);
				socket.emit('userConfirm', {uID: socket.username, msg: 'Success!'}, socket.room);
				socket.emit('serverSelfMsg', '[SERVER] You have connected', socket.room);
				socket.broadcast.to(socket.room).emit('serverOthersMsg', '[SERVER] ' + packet.usr + ' has login');
				
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
			socket.broadcast.to(socket.room).emit('serverOthersMsg', '[SERVER] ' + socket.username + ' has left');
			delete loginUsers[socket.username];

			userNumber = userNumber - 1;
			console.log('usernumber = ' + userNumber);
		}
	});

	// when the socket with tag 'chat message' is received, send socket with tag 'chat' to all the user
	socket.on('chat message', function(input) {
		var sysTime = getDateTime();
		var content = {
			uID: socket.username,
			pID: postID,
			msg: input,
			sysTime: sysTime,
			block: loginUsers[socket.username].block,
			uColor: colorName[loginUsers[socket.username].userColor]
		};
		
		// dbLink.query("INSERT INTO syslog VALUES ($1, $2, $3, $4, $5)", [content.uID, postID, socket.room, content.sysTime, input]);
		postID++;

		io.sockets.in(socket.room).emit('chat', content);
	});

	// Pass translate result from server
	socket.on('translate', function(packet) {
		if (ctrlLock.hasOwnProperty(packet.pID)) {

			var params = { text: packet.word, from: packet.fromLanguage, to: packet.toLanguage };
			var result = { uID: packet.uID, fromWord: packet.word.replace(/\n/g, '<br>'), toWord: null, pID: packet.pID };

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
		loginUsers[socket.username].block = input;
		socket.broadcast.to(socket.room).emit('partnerMsgBlock', {blockInfo: input, uID: socket.username});
	});

	socket.on('shareMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgShare', {pID: pID, blockInfo: loginUsers[socket.username].block});
	});

	socket.on('unshareMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgUnshare', {pID: pID, blockInfo: loginUsers[socket.username].block});
	});

	socket.on('likeMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgLike', pID);
	});

	socket.on('dislikeMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgDislike', pID);
	});

	socket.on('revert', function(packet) {
		io.sockets.in(socket.room).emit('revertMsg', packet);
	});

	socket.on('reg', function(packet) {
		dbLink.query("SELECT uID FROM userInfo", function(err, result) {
			var reged = false;
			if(err) return console.error('error running query', err); 
			
			regUsers = result.rows;

			for(var i = 0; i < result.rows.length; i ++) {
				if (result.rows[i].uid === packet.usr) reged = true;
			}

			if (reged) {
				socket.emit('regError', 'this userID is registered!');
			} else {
				var msg = 'Success! Back to <a href="/">Login Page</a> !';
				hash(packet.pwd, function(err, salt, cipher) {
					if (err) throw err;
					dbLink.query("INSERT INTO userInfo VALUES ($1, $2, $3, $4)", [packet.usr, cipher.toString(), salt, packet.group]);
				});
				socket.emit('regSuccess', msg);
			}
		});
	});
});
