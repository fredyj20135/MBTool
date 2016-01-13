/* Default lib initialization */
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var hash = require('./pass').hash;
var IP = '127.0.0.1';
var DBON = true;

/* System attribute initialization */
var config = JSON.parse(fs.readFileSync('./config', 'utf8'));

/* Postgres database initialization */
var pg = require('pg');
var db = new pg.Client(config.DB);
db.connect();

/* Bing Translator initialization */
var mstranslator = require('mstranslator');
var translateWizard = new mstranslator({ client_id: config.MT.cID, client_secret: config.MT.secret}, true);

/* System tracking initialization */ 
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
server.listen(5092, IP, function() { console.log('Server Start! Listening on #: 5092'); });

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
	db.query("SELECT * FROM userInfo WHERE uid = $1", [name], function(err, result) {
		if(err) fn(new Error('Query Problem!'));

		if (result.rows[0] == null) return fn(new Error('Unregistered user!'));
		else {
			hash(pass, result.rows[0].salt, function(err, cipher) {
				if (err) return fn(err);

				if (cipher.toString() == result.rows[0].pwd) return fn(null, {usr: name, room: result.rows[0].groupname});
				else return fn(new Error('Invalid password'));
			});
		}
	});
}

function colorCode(name) {
	var j = 0;
	for (var i = 0; i < name.length; i++) j = j + name.charCodeAt(i);
	return j % 6;
}

// now in DB: uID, room, action:I/M/B/S/L/T, pID, systime, content
// I: Initial, M: Message, B: Block, S: Share, L: Like, T: Translate
function dbLogInsert(user, room, action, pID, sysTime, content) {
	if (DBON) {
		db.query("INSERT INTO syslog VALUES ($1, $2, $3, $4, $5, $6)", 
			[user, room, action, pID, sysTime, content],
			function(err, result) {
				if(err) return console.error('error running query', err);
				// console.log(result);
			}
		);
	}
}

io.on('connection', function(socket) {
	socket.on('login', function(packet) { // there is a room name in packet now!
		authenticate(packet.usr, packet.pwd, function(err, user) {
			if (user) {
			// if (true) { //  any users are allowed!
				socket.room = user.room;
				socket.join(user.room);
				var temp = {userID: packet.usr, userColor: colorCode(packet.usr), blocks: false, room: user.room};

				if (!DBON) {
					socket.room = 'room1'; 
					socket.join('room1'); 
					temp.room = 'room1';
				}
				
				socket.username = temp.userID;
				socket.emit('userConfirm', {uID: socket.username, msg: 'Success!'}, socket.room);
				socket.emit('serverSelfMsg', '[SERVER] Hello ' + socket.username + '!', socket.room);
				socket.broadcast.to(socket.room).emit('serverOthersMsg', '[SERVER] ' + packet.usr + ' has login');

				var i = 0;
				for (e in loginUsers) {
					if (loginUsers[e].room == socket.room) {
						socket.emit('serverSelfMsg', '[SERVER] ' + loginUsers[e].userID + ' is now in room!', socket.room);
						i++;
					}
				}
				if (i == 0) dbLogInsert('SYSTEM', socket.room, 'I', -1, getDateTime(), 'START ' + socket.room);
				
				loginUsers[temp.userID] = temp;
				userNumber = userNumber + 1;

				console.log('user #: ' + userNumber);
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
			console.log('user #: ' + userNumber);
		}
	});

	// when the socket with tag 'chat message' is received, send socket with tag 'chat' to all the user
	socket.on('chat message', function(input) {
		if (input.length > 500) input = input.substring(0, 500);

		var content = {
			uID: socket.username,
			pID: postID,
			msg: input,
			sysTime: getDateTime(),
			block: loginUsers[socket.username].block,
			uColor: colorName[loginUsers[socket.username].userColor]
		};

		dbLogInsert(content.uID, socket.room, 'M', postID, content.sysTime, input);
		
		postID++;

		io.sockets.in(socket.room).emit('chat', content);
	});

	// Pass translate result from server
	socket.on('translate', function(packet) {
		if (ctrlLock.hasOwnProperty(packet.pID)) {

			if (packet.word.length > 500) packet.word.substring(0, 500);

			var params = { text: packet.word, from: packet.fromLanguage, to: packet.toLanguage };
			var result = { uID: packet.uID, fromWord: packet.word.replace(/\n/g, '<br>'), toWord: null, pID: packet.pID };

			translateWizard.translate(params, function(err, data) {
				result.toWord = data;
				io.sockets.in(socket.room).emit('is BINDED', result);
			});

			dbLogInsert(socket.username, socket.room, 'T', postID, getDateTime(), packet.word);
		}
	});

	socket.on('ctrlLock', function(pID) {
		ctrlLock[pID] = true;
	});

	socket.on('ctrlUnlock', function(pID) {
		delete ctrlLock[pID];
	});

	socket.on('blockMsg', function(input) {
		var msg;
		input == true? msg = ' ' : msg = ' un';
		loginUsers[socket.username].block = input;

		socket.broadcast.to(socket.room).emit('partnerMsgBlock', {blockInfo: input, uID: socket.username});
		socket.emit('serverSelfMsg', '[SERVER] You are in' + msg + 'block mode!', socket.room);
		socket.broadcast.to(socket.room).emit('serverOthersMsg', '[SERVER] ' + socket.username + ' is in' + msg + 'block mode!');

		dbLogInsert(socket.username, socket.room, 'B', -1, getDateTime(), input);
	});

	socket.on('shareMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgShare', {pID: pID, blockInfo: loginUsers[socket.username].block});

		dbLogInsert(socket.username, socket.room, 'S', pID, getDateTime(), '1');
	});

	socket.on('unshareMsg', function(pID) {
		socket.broadcast.to(socket.room).emit('partnerMsgUnshare', {pID: pID, blockInfo: loginUsers[socket.username].block});

		dbLogInsert(socket.username, socket.room, 'S', pID, getDateTime(), '0')
	});

	socket.on('likeMsg', function(pID) {
		io.sockets.in(socket.room).emit('partnerMsgLike', pID);

		dbLogInsert(socket.username, socket.room, 'L', pID, getDateTime(), '1')
	});

	socket.on('dislikeMsg', function(pID) {
		io.sockets.in(socket.room).emit('partnerMsgDislike', pID);

		dbLogInsert(socket.username, socket.room, 'L', pID, getDateTime(), '0');
	});

	socket.on('revert', function(packet) {
		io.sockets.in(socket.room).emit('revertMsg', packet);

		dbLogInsert(socket.username, socket.room, 'R', packet.pID, getDateTime(), '-');
	});

	socket.on('reg', function(packet) {
		if 		(packet.usr == '' || packet.usr == null || packet.usr.length > 20) socket.emit('regError', 'invalid username!');
		else if (packet.pwd == '' || packet.pwd == null || packet.pwd.length > 20) socket.emit('regError', 'invalid password!');
		else if (packet.usr.indexOf('/0x00') > 0 || packet.pwd.indexOf('/0x00') > 0) socket.emit('regError', 'invalid input');
		else {
			console.log('user string: ' + packet.usr);
			packet.usr.replace(/[\\$'"]/g, "\\$&").replace(/\u0000/g, '\\0');
			console.log('user sign up: ' + packet.usr);
			db.query("SELECT * FROM userInfo WHERE uid = ($1)" ,[packet.usr],  function(err, result) {
				if(err) return console.error('error running query', err); 

				if (result.rows[0] != null) {
					console.log(result.rows)
					socket.emit('regError', 'this userID is registered!');
				} else {
					var msg = 'Success! Back to <a href="/">Login Page</a> !';
					hash(packet.pwd, function(err, salt, cipher) {
						if (err) throw err;
						db.query("INSERT INTO userInfo VALUES ($1, $2, $3, $4)", 
							[packet.usr, cipher.toString(), salt, packet.group], 
							function(err) {
								if(err) {
									return console.error('error running query', err);
									socket.emit('regError', 'please recheck your information');
								}
								else socket.emit('regSuccess', msg);
							}
						);
					});
				}
			});
		}
	});
});