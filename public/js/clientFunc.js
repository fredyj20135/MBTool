var socket = io.connect('http://localhost:5092');
var username;
var blockMode = 'unblock';
var colMode = 'twoCol';
var highlightWord = '';

/* Socket.io function, start */
socket.on('ping', function(data) { socket.emit('pong', {beat: 1 }); });

socket.on('connect', function() {
	$('#loginInput').on('click', loginBtHandler);
	$(document).on('keypress', loginBtEnterHandler);
});

socket.on('connect_error', function(err) { 
	$('#sendButton').off('click', sendBtHandler);
	$('#container').off('click', 'input.likeBt');
	$('#container').off('click', 'input.shareBt');
	$('#container').off('click', 'input.revertBt');
	$('#container').off('click', 'input.translateBt');

	var serverMsg = $('<div>').text('[SERVER] You are disconnected! Please be sure that all the record is preserved!')
		.addClass('userMessage systemMessage');

	addUserMsgByColMode(serverMsg);

	socket.io.close();
});

socket.on('loginError', function(msg) { 
	$('#loginMsg').text(msg); 
	$('#username').focus();
});

// socket.on('resRoomInfo', function(packet) {

// });

socket.on('userConfirm', function(packet) {
	$('#loginMsg').text(packet.msg);

	$('#loginInput').off('click', loginBtHandler);
	$(document).off('keypress', loginBtEnterHandler);

	$("#loginBody").animate({opacity: 0, hight: 0}, 600, 'swing', function() {
		$("#loginBody").hide();
		$('#controlPanel').css('visibility', 'visible');
		$('#BSTBody').css('visibility', 'visible').fadeIn('slow');
		$('#textInput').focus();
	});

	username = packet.uID;

	if (parseInt(packet.room.substring(5, 7)) == 0) $('#roomInfo').text('Big Room');
	else $('#roomInfo').text(packet.room);

	$('#settingBt').on('click', settingBtHandler);
	$('#showLiked').on('click', bubbleLikedCtrlHandler);
	$('input[name=view]').on('click', blockMsgHandler);
	$('input[name=colMode]').on('click', windowCtrlBtHandler);
	$('#textInput').on('keyup keydown', inputCountHandler);
	$('#textInput').on('keypress', sendBtEnterHandler);
	$('#sendButton').on('click', sendBtHandler);

	$('#emitAll').prop('disabled', true).hide();
	$('#unblock').attr('checked', true);
	$('#twoCol').attr('checked', true);
	$("#enterCheck").click();

	$(window).on('beforeunload', function() {
		return 'All messages will be droped if you leave or relaod this page. \n\nAre you sure?'; 
	});
});

/* distribute System Msg */ 
socket.on('serverSelfMsg', function(msg) { /* server msg related to user */
	var serverMsg = $('<div>').text(msg).addClass('userMessage systemMessage');
	addUserMsgByColMode(serverMsg);
});

socket.on('serverOthersMsg', function(msg) { /* server msg related to others */
	$('#partnerMsgContainer').append($('<div>').text(msg).addClass('partnerMessage systemMessage'))
		.scrollTop($('#partnerMsgContainer').prop("scrollHeight"));
});

socket.on('partnerMsgLike', function(pID) { /* set like */
	var post = $('.postID:contains("' + pID + '")').parent();
	var a = parseInt($(post[0]).find('.likeNum').text());

	$(post).each(function() { $(this).find('.likeNum').text(a + 1); });
});

socket.on('partnerMsgDislike', function(pID) { /* Disliked */
	var post = $('.postID:contains("' + pID + '")').parent();
	var a = parseInt($(post[0]).find('.likeNum').text());

	$(post).each(function() { $(this).find('.likeNum').text(a - 1); });
});

socket.on('memberLogin', function(packet) {
	var icon = $('<span>').addClass('icon').addClass(packet.uColor);
	var nameSpace = $('<span>').addClass('memberName').text(packet.uID);
	var newMember = $('<div>').addClass('memberElement').append(icon).append(nameSpace);

	$('#memberWrap').append(newMember);
});

socket.on('memberLogout', function(uID) {
	$('.memberName').each(function() {
		if ($(this).text() == uID) $(this).parent().remove();
	});
});


/* Manipulate chat message, distribute user's and partner's messages
 * packet : uID: USERNAME, pID: POST ID, msg: MESSAGE, sysTime: SYSTEM TIME, block: MSG HIDE, uColor: COLOR*/
socket.on('chat', function(packet) {
	var uID = packet.uID;
	var postTime = packet.sysTime;

	var postID 		= $('<span>').addClass('postID').html(packet.pID).hide();
	var content 	= $('<span>').addClass('msgTxt').text(packet.msg);
	var icon 		= $('<span>').addClass('partnerIcon').addClass(packet.uColor);
	var nameSpace 	= $('<span>').addClass('nameSpace').text('By ' + uID);
	var sysTime 	= $('<span>').addClass('sysTime').text(postTime).hide();
	var timeStamp	= $('<span>').addClass('timeStamp').html('@ ' + localTime()).append(sysTime);
	var likeBt 		= $('<input>').addClass('likeBt').prop({type: 'button', value: ''});
	var likeNum		= $('<span>').addClass('likeNum').text('0');
	var shareBt 	= $('<input>').addClass('shareBt').prop({type: 'button', value: ''}).hide();
	var translateBt = $('<input>').addClass('translateBt').prop({type: 'button', value: 'Translate'});
	var revertBt 	= $('<input>').addClass('revertBt').prop({type: 'button', value: 'Revert'}).hide();
	
	content.html(content.html().replace(/\n/g, '<br>'));
	content = $('<span>').addClass('msgCntnt').append(content).append('<br>').append(likeNum).append(likeBt);

	if (uID == username) {
		content = content.append(shareBt).append(timeStamp);
		content = $('<div>').addClass('userMessage').append(postID).append(content);

		if (packet.block == true) shareBt.show();

		addUserMsgByColMode(content);
	} else {
		content = content.append(nameSpace).append(timeStamp).append(revertBt).append(translateBt);
		content = $('<div>').addClass('partnerMessage').append(icon).append(postID).append(content);

		if (packet.block == true) content.find('.msgCntnt').addClass('block');

		$('#partnerMsgContainer').append(content).scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
	}
});

socket.on('partnerMsgBlock', function(packet){
	$('.partnerMessage').each(function(){
		if (!$(this).hasClass('share') && $(this).find('.nameSpace').text() == 'By '+ packet.uID) {
			if (packet.blockInfo == true) $(this).find('.msgCntnt').addClass('block');
			else $(this).find('.msgCntnt').removeClass('block');
		}
	});
});

socket.on('partnerMsgShare', function(packet) { /* Share on the specific message */
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	$(partnerMsg).each(function() {
		$(this).addClass('share');
		$(this).find('.msgCntnt').removeClass('block');
	});
});

socket.on('partnerMsgUnshare', function(packet) {
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	$(partnerMsg).each(function() {
		$(this).removeClass('share');
		if (packet.blockInfo == true) $(this).find('.msgCntnt').addClass('block');
	});
});

socket.on('isBINDED', function(packet) { /* Get translated data and add to message */
	var result = $('<span>').addClass('trans').html(' (' + packet.toWord + ')');
	var transMsg = $(".postID:contains('" + packet.pID + "')").parent();

	result = $('<span>').addClass('highlight').prop('title', 'By ' + packet.uID).html(packet.fromWord).append(result);

	$(transMsg).each(function() {
		var transMsgTxt = $(this).find('.msgTxt');

		if (transMsg.hasClass('partnerMessage')) {
			if (packet.uID == username) {
				$(this).find('.revertBt').show();
				$(this).find('.translateBt').prop('disabled', false).val('Translate').removeClass('working');
			}
			result.addClass('note');
		}
		else if ($(this).hasClass('userMessage')) result.addClass('warn');
		transMsgTxt.html(powerReplace(transMsgTxt.html(), packet.fromWord, result.prop('outerHTML')));
	});
	
	if (packet.uID == username) socket.emit('ctrlUnlock', packet.pID);
});

socket.on('badBIND', function(packet) {
	var transMsg = $(".postID:contains('" + packet.pID + "')").parent();
	$(transMsg).each(function() {
		$(this).find('.translateBt').prop('disabled', false).val('Translate').removeClass('working');
	});

	var serverMsg = $('<div>').text(packet.msg).addClass('userMessage systemMessage');
	addUserMsgByColMode(serverMsg);
	
	socket.emit('ctrlUnlock', packet.pID);
});

socket.on('revertMsg', function(packet) { /* Erase translation in specific bubbles, improvable! */
	var msgPool = $('.postID:contains("' + packet.pID + '")').parent();

	$(msgPool).each(function() {
		var msgText = $(this).find('.msgTxt');
		var highlight = msgText.find('.highlight');
		var elmt, temp;
		var revertHTML = msgText.html();
	
		for (var j = highlight.length; j > 0; j--) { // special use, so no each
			elmt = $(highlight[j - 1]);

			if (elmt != null && elmt.prop('title').slice(3, elmt.prop('title').length) == packet.uID) {
				temp = elmt.clone();
				elmt.find('.trans:last').detach();
				revertHTML = revertHTML.replace(temp.prop('outerHTML'), elmt.html());
			}
			msgText.html(revertHTML);
			highlight = msgText.find('.highlight');
		}
	});

	if (packet.uID == username) {
		socket.emit('ctrlUnlock', packet.pID);
		$(msgPool).each(function() {
			$(this).find('.revertBt').hide();
		});
	}
});
/* Socket.io function, end */

/* Support function, start */
/* SHOW or HIDE Msg by column mode */
function addUserMsgByColMode(content) {
	var hidden = content.clone().hide().addClass('lie');
	if (colMode == 'twoCol') {
		$('#partnerMsgContainer').append(hidden);
		$('#userMsgContainer').append(content).scrollTop($('#userMsgContainer').prop('scrollHeight'));
	} else if (colMode == 'oneCol'){
		$('#userMsgContainer').append(hidden);
		$('#partnerMsgContainer').append(content).scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
	}
}

/* Prevent translation in tag */
function powerReplace(oriHTML, fromWord, transResult) {
	var temp = '', outHTML = '';
	var inTag = false;
	var i = 0, j = 0;

	if (oriHTML === fromWord) return transResult;

	oriHTML = oriHTML.replace(/<br>/g, '%br%');
	fromWord = fromWord.replace(/<br>/g, '%br%');

	for (i = 0; i < oriHTML.length; i++) {
		if (oriHTML[i] === '<') inTag = true;
		inTag == true? temp = temp + '#' : temp = temp + oriHTML[i];
		if (oriHTML[i] === '>') inTag = false;
	}

	var index = temp.toString().indexOf(fromWord);
	if (index < 0) return oriHTML.toString().replace(/%br%/g, '<br>');

	i = 0;
	while (i <= oriHTML.length - fromWord.length + transResult.length) {
		if (i != index) {
			outHTML = outHTML + oriHTML[j];
			j++;
		} else {
			outHTML = outHTML + transResult;
			j = j + fromWord.length;
			i = i + transResult.length;
		} 
		i++;
	}

	return outHTML.toString().replace(/%br%/g, '<br>');
}

/* Put local time function */
function localTime() {
	var date = new Date();
	var hour = date.getHours();			hour = (hour < 10 ? "0" : "") + hour;    
	var min  = date.getMinutes();		min = (min < 10 ? "0" : "") + min;
	var sec  = date.getSeconds();		sec = (sec < 10 ? "0" : "") + sec;
	
	return hour + ':' + min + ':' + sec;
}

/* "VIEW" setting on some button */
function clickControl(elmt) {
	if (elmt.hasClass('clicked')) elmt.removeClass('clicked');
	else elmt.addClass('clicked');
}

/* Catch user highlighted word (for translate)*/
$('#container').on('mouseup', '.partnerMessage', function() {
	if (window.getSelection) {
		highlightWord = window.getSelection().toString();
	}else if (document.getSelection){
		highlightWord = document.getSelection().toString();
	}else if (document.selection) {
		highlightWord = document.selection.createRange().text.toString();
	}
});
/* Support function, end */

/* "CONTROL", handler for buttons, Concept by Allie and Seraphina. Start */
function loginBtHandler() {
	socket.emit('login', {usr: $('#username').val(), pwd: $('#pwd').val(), room: $('#roomName').val()});
	$('#username').val('');
	$('#pwd').val('');
}
function loginBtEnterHandler(event) {
	if (event.which == 13) $('#loginInput').click();
}

/* Buttons in setting menu. Concept by Allie */
function settingBtHandler() {
	clickControl($('#settingBt'));
	$('#settingWrap').toggle('blind', {direction: 'right'}, 500);
}

function blockMsgHandler() {
	var newMode = $('input[name=view]:checked').val();
	var blockInfo;

	if (newMode != blockMode) {
		newMode == 'block'? blockInfo = true : blockInfo = false;
		$('#' + newMode).attr('checked', true);
		
		$('#emitAll').prop('disabled', !blockInfo);
		$('.shareBt').each(function() {$(this).toggle(); });
		$('#emitAll').toggle('blind', { direction: 'right' }, 300);
		
		socket.emit('blockMsg', blockInfo);
		blockMode = newMode;
	}
}

$('#emitAll').click(function() {
	$('input.shareBt').each(function() {
		if (!$(this).hasClass('clicked')) $(this).click();
	});
});

function windowCtrlBtHandler() {
	var stretch, shrink, uWidth, pWidth;
	var mode = $('input[name=colMode]:checked').val();
	
	if (mode != colMode) {
		$('#' + mode).attr('checked', true);
		if ($('#showLiked').hasClass('clicked')) $('#showLiked').click();

		if (mode == 'oneCol') windowViewHandler('100%', '0%', '#userMsgContainer', '#partnerMsgContainer');
		else if (mode == 'twoCol') windowViewHandler('50%', '50%', '#partnerMsgContainer', '#userMsgContainer');

		$('input[name=colMode]').prop('disabled', true);
		colMode = mode;
	}
}

function windowViewHandler(pWidth, uWidth, shrink, stretch) {
	var delay = 0;
	$(shrink + ' .userMessage').each(function() { $(this).hide().addClass('lie'); });
	$('#userMsgContainer').animate({ width: uWidth }, { duration: 300, queue: true });
	$('#partnerMsgContainer').animate({ width: pWidth}, { duration: 300, queue: true, complete: function() {
		$(stretch + ' .userMessage').each(function() { 
			$(this).delay(delay).show(500, function() {
				if ($(this).is(":visible")) 
					$(stretch).animate({scrollTop: $(stretch).prop('scrollHeight') }, 150);
			});
			$(this).removeClass('lie');
			delay += 100;
		});
	}});
	$(shrink).animate({scrollTop: $(shrink).offset().top}, 100, function() { $('input[name=colMode]').prop('disabled', false); });
	$(stretch).animate({scrollTop: $(stretch).offset().top}, 100);	
}

function bubbleLikedCtrlHandler() {
	clickControl($('#showLiked'));

	if ($('#showLiked').hasClass('clicked')) {
		$('.msgCntnt').each(function() {
			var likeNum = parseInt($(this).find('.likeNum').text());
			var msg = $(this).parent();
			if (likeNum == 0 || $(this).hasClass('block')) {
				if (!msg.hasClass('lie')) msg.hide('fast');
				msg.addClass('vote');
			}
		});

		$('.systemMessage').each(function() { 
			if (!$(this).hasClass('lie')) $(this).hide('fast');
			$(this).addClass('vote');
		});

		$('#showLiked').val('Show liked bubbles: On')
	} else {
		$('.vote').each(function() { 
			if (!$(this).hasClass('lie')) $(this).show('fast');
			$(this).removeClass('vote');
		});

		$('#showLiked').val('Show liked bubbles: Off')
	}
}

/* Buttons in inputWrap*/
function sendBtHandler() {
	if ($.trim($('#textInput').val()) !== "") {
		socket.emit('chatMsg', $('#textInput').val());
		$('#textInput').val('').focus();
		$('#textLimit').hide();
	}
}

function sendBtEnterHandler(event) {
	if (event.which == 13 && !event.shiftKey) {
		event.preventDefault();
		$('#sendButton').click();
	}
}

function inputCountHandler() {
	var limit = 500;
	if ($('#textInput').val().length < limit) {
		$('#textInput').off('keypress').on('keypress');
	} else {
		$('#textInput').on('keypress', function() { return false });
		$('#textInput').val($('#textInput').val().substring(0, limit));
	}
}

$('#enterCheck').click(function() {
	clickControl($('#checkLabel'));
	$('#sendButton').prop('disabled', $('#enterCheck').prop('checked'));

	if($(this).prop('checked')) $(document).on('keypress', sendBtEnterHandler);
	else $(document).off('keypress', sendBtEnterHandler);
});

/* Like "one's" message */
$('#container').on('click', 'input.likeBt', function() { 
	var postID = $(this).parent().siblings('.postID').text();
	var msg = $('.postID:contains("' + postID + '")').parent();

	$(msg).each(function() { 
		clickControl($(this).find('input.likeBt'));
	});

	if ($(this).hasClass('clicked')) socket.emit('likeMsg', postID);
	else socket.emit('dislikeMsg', postID);
});

/* Share own message button*/
$('#container').on('click', 'input.shareBt', function() { 
	var postID = $(this).parent().siblings('.postID').text();
	var msg = $('.postID:contains("' + postID + '")').parent();

	$(msg).each(function() {
		var shareBt = $(this).find('input.shareBt');
		clickControl(shareBt);

		if (shareBt.hasClass('clicked')) $(this).addClass('share');
		else $(this).removeClass('share');
	});
	if ($(this).hasClass('clicked')) socket.emit('shareMsg', postID);
	else socket.emit('unshareMsg', postID);
});

/* Send translate request */
$('#container').on('click', 'input.translateBt', function() {
	var partnerMsg = $(this).closest('.partnerMessage');
	var postID = partnerMsg.find('.postID').text();
	var transWord;

	socket.emit('ctrlLock', postID);
	
	if (highlightWord != '') transWord = highlightWord;
	else {
		if (partnerMsg.find('.highlight').length == 0) 
			transWord = partnerMsg.find('.msgTxt').html().replace(/<br>/g, '\n');
		else transWord = '';
	}

	if (transWord != '') {
		var transElement = { 
			uID: username,
			word: transWord, 
			pID: postID,
			fromLanguage: $('#oriLang').val(), 
			toLanguage: $('#transLang').val()
		};
		socket.emit('translate', transElement);

		$(this).prop('disabled', true).val('WAIT...').addClass('working');
	}
});

/* Send revert translation request */
$('#container').on('click', 'input.revertBt', function() {
	var partnerMsg = $(this).closest('.partnerMessage');
	var postID = partnerMsg.find('.postID').text();

	socket.emit('ctrlLock', postID);
	socket.emit('revert', {pID: postID, uID: username});
});

/* initial page setting */		
$(document).ready(function() {
	$('#BSTBody').hide();
	$('#settingWrap').hide();
});