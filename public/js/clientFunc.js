var socket = io.connect('http://localhost:5092');
var username;
var twoCol = true;
var blockMode = 'unblock';
var highlightWord = '';
			
socket.on('ping', function(data) { socket.emit('pong', {beat: 1 }); });

/* Socket.io function, start */
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
		.addClass('userMessage');

	addUserMsgByColMode(serverMsg);

	socket.io.close();
});

socket.on('loginError', function(msg) { 
	$('#loginMsg').text(msg); 
	$('#username').focus();
});

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

	$('#roomInfo').text(packet.room[0] + 'roup ' + packet.room[1]); // how bad...

	$('#settingBt').on('click', settingBtHandler);
	$('#showLiked').on('click', bubbleLikedCtrlHandler);
	$('input[name=colMode]').on('click', windowCtrlBtHandler);
	$('input[name=view]').on('click', blockMsgHandler);
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

	for (var i = 0; i < post.length; i++) $(post[i]).find('.likeNum').text(a + 1);
});

socket.on('partnerMsgDislike', function(pID) { /* Disliked */
	var post = $('.postID:contains("' + pID + '")').parent();
	var a = parseInt($(post[0]).find('.likeNum').text());

	for (var i = 0; i < post.length; i++) $(post[i]).find('.likeNum').text(a - 1);
});

/* Manipulate chat message, distribute user's and partner's messages
 * packet : uID: USERNAME, pID: POST ID, msg: MESSAGE, sysTime: SYSTEM TIME, block: MSG HIDE, uColor: COLOR*/
socket.on('chat', function(packet) {
	var uID = packet.uID;
	var postTime = packet.sysTime;

	var content 	= $('<span>').addClass('msgTxt').text(packet.msg);
	var shareBt 	= $('<input>').addClass('shareBt').prop({type: 'button', value: ''}).hide();
	var likeBt 		= $('<input>').addClass('likeBt').prop({type: 'button', value: ''});
	var likeNum		= $('<span>').addClass('likeNum').text('0');
	var translateBt = $('<input>').addClass('translateBt').prop({type: 'button', value: 'Translate'});
	var revertBt 	= $('<input>').addClass('revertBt').prop({type: 'button', value: 'Revert'}).hide();
	var timeStamp 	= $('<span>').addClass('timeStamp').html(postTime);
	var postID 		= $('<span>').addClass('postID').html(packet.pID).hide();
	var nameSpace 	= $('<span>').addClass('name').text(uID);
	var icon 		= $('<div>').addClass('partnerIcon').addClass(packet.uColor);
	
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

function addUserMsgByColMode(content) {
	var hidden = content.clone().hide().addClass('lie');
	if (twoCol) {
		$('#partnerMsgContainer').append(hidden);
		$('#userMsgContainer').append(content).scrollTop($('#userMsgContainer').prop('scrollHeight'));
	} else {
		$('#userMsgContainer').append(hidden);
		$('#partnerMsgContainer').append(content).scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
	}
}

socket.on('partnerMsgBlock', function(packet){
	$('.partnerMessage').each(function(){
		if (!$(this).hasClass('share') && $(this).find('.name').text() == packet.uID) {
			if (packet.blockInfo == true) $(this).find('.msgCntnt').addClass('block');
			else $(this).find('.msgCntnt').removeClass('block');
		}
	});
});

socket.on('partnerMsgShare', function(packet) { /* Share on the specific message */
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < partnerMsg.length; i++) {
		$(partnerMsg[i]).addClass('share');
		$(partnerMsg[i]).find('.msgCntnt').removeClass('block');	
	}
});

socket.on('partnerMsgUnshare', function(packet) {
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < partnerMsg.length; i++) {
		$(partnerMsg[i]).removeClass('share');
		if (packet.blockInfo == true) $(partnerMsg[i]).find('.msgCntnt').addClass('block');
	}
});

socket.on('is BINDED', function(packet) { /* Get translated data and add to message */
	var result = $('<span>').addClass('trans').html(' (' + packet.toWord + ')');
	var transMsg = $(".postID:contains('" + packet.pID + "')").parent();

	result = $('<span>').addClass('highlight').prop('title', 'By ' + packet.uID).html(packet.fromWord).append(result);

	for (var i = 0; i < transMsg.length; i++) {
		var transMsgTxt = $(transMsg[i]).find('.msgTxt');

		if (transMsg.hasClass('partnerMessage')) {
			if (packet.uID == username) {
				transMsg.find('.revertBt').show();
				transMsg.find('.translateBt').prop('disabled', false).val('Translate').removeClass('working');
			}
			result.addClass('note');
		}
		else if (transMsg.hasClass('userMessage')) result.addClass('warn');
		transMsgTxt.html(powerReplace(transMsgTxt.html(), packet.fromWord, result.prop('outerHTML')));
	}
	
	if (packet.uID == username) socket.emit('ctrlUnlock', packet.pID);
});
/* end */

/* Prevent translation in tag */
function powerReplace(oriHTML, fromWord, transResult) { // the most important is that don't replace tag
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

socket.on('revertMsg', function(packet) { /* Erase translation in specific bubbles, improvable! */
	var msgPool = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < msgPool.length; i++) {
		var msgText = $(msgPool[i]).find('.msgTxt');
		var highlight = msgText.find('.highlight');
		var elmt, temp;
		var revertHTML = msgText.html();
	
		for (var j = highlight.length; j > 0; j--) { 
			elmt = $(highlight[j - 1]);

			if (elmt != null && elmt.prop('title').slice(3, elmt.prop('title').length) == packet.user) {
				temp = elmt.clone();
				elmt.find('.trans:last').detach();
				revertHTML = revertHTML.replace(temp.prop('outerHTML'), elmt.html());
			}
			msgText.html(revertHTML);
			highlight = msgText.find('.highlight');
		}
		if ($(msgPool[i]).find('.revertBt').length != 0) $(msgPool[i]).find('.revertBt').hide();
	}

	if (packet.uID == username) socket.emit('ctrlUnlock', packet.pID);
});

function loginBtHandler() {
	socket.emit('login', {usr: $('#username').val(), pwd: $('#pwd').val()});
	$('#username').val('');
	$('#pwd').val('');
}

function loginBtEnterHandler(event) {
	if (event.which == 13) $('#loginInput').click();
}

/* Buttons in controlPanel. Concept by Allie. Start */
function settingBtHandler() {
	clickControl($('#settingBt'));
	$('#settingPanel').toggle('blind', {direction: 'right'}, 500);
}

function windowCtrlBtHandler() {
	var delay = 0;
	var stretch, shrink, uWidth, pWidth;
	twoCol == true? twoCol = false : twoCol = true;
	var mode = $('input[name=colMode]:checked').val();

	$('input[name=colMode]').prop('disabled', true);

	if (mode == 'oneCol') {
		pWidth = '100%';	uWidth = '0%';
		shrink = '#userMsgContainer';
		stretch = '#partnerMsgContainer';
	} else if (mode == 'twoCol'){
		pWidth = '50%';		uWidth = '50%';
		stretch = '#userMsgContainer';
		shrink = '#partnerMsgContainer';
	}

	$('#' + mode).attr('checked', true);
	if ($('#showLiked').hasClass('clicked')) $('#showLiked').click();

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
	$(shrink).animate({scrollTop: $(this).offset().top}, 100, function() { $('input[name=colMode]').prop('disabled', false); });
	$(stretch).animate({scrollTop: $(this).offset().top}, 100);	
}

function sendBtHandler() {
	if ($.trim($('#textInput').val()) !== "") {
		socket.emit('chat message', $('#textInput').val());
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

function bubbleLikedCtrlHandler() {
	clickControl($('#showLiked'));

	if ($('#showLiked').hasClass('clicked')) {
		$('.msgCntnt').each(function() {
			var likeNum = parseInt($(this).find('.likeNum').text());
			var msg = $(this).parent();
			if (likeNum == 0) {
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

function inputCountHandler() {
	var limit = 500;
	if ($('#textInput').val().length < limit) {
		$('#textLimit').hide();
		$('#textInput').off('keypress').on('keypress');
	} else {
		$('#textInput').on('keypress', function() { return false });
		$('#textLimit').show();
		$('#textInput').val($('#textInput').val().substring(0, limit));
	}
}
/* end */

/* Buttons controling bubbles. Concept by Allie and Seraphina. Start */
function clickControl(elmt) {
	if (elmt.hasClass('clicked')) elmt.removeClass('clicked');
	else elmt.addClass('clicked');
}

$('#emitAll').click(function() {
	$('input.shareBt').each(function() {
		if (!$(this).hasClass('clicked')) $(this).click();
	});
});

$('#enterCheck').click(function() {
	clickControl($('#checkLabel'));
	$('#sendButton').prop('disabled', $('#enterCheck').prop('checked'));

	if($(this).prop('checked')) $(document).on('keypress', sendBtEnterHandler);
	else $(document).off('keypress', sendBtEnterHandler);
});

/* Like "partner's" message button */
$('#container').on('click', 'input.likeBt', function() { 
	var postID = $(this).parent().siblings('.postID').text(); // relatively unsave, because knowing structure
	var msg = $('.postID:contains("' + postID + '")').parent();

	for (var i = 0; i < msg.length; i++) {
		var likeBt = $(msg[i]).find('input.likeBt');
		clickControl(likeBt);
	}
	if (likeBt.hasClass('clicked')) socket.emit('likeMsg', postID);
	else socket.emit('dislikeMsg', postID);
});

/* Share "user's" message button*/
$('#container').on('click', 'input.shareBt', function() { 
	var postID = $(this).parent().siblings('.postID').text(); // relatively unsave
	var msg = $('.postID:contains("' + postID + '")').parent();

	for (var i = 0; i < msg.length; i++) {
		var shareBt = $(msg[i]).find('input.shareBt');
		clickControl(shareBt);

		if (shareBt.hasClass('clicked')) $(msg[i]).addClass('share');
		else $(msg[i]).removeClass('share');
	}
	if (shareBt.hasClass('clicked')) socket.emit('shareMsg', postID);
	else socket.emit('unshareMsg', postID);
});
/* end */ 

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

/* Send revert request */
$('#container').on('click', 'input.revertBt', function() {
	var partnerMsg = $(this).closest('.partnerMessage');
	var postID = partnerMsg.find('.postID').text();

	socket.emit('ctrlLock', postID);
	socket.emit('revert', {pID: postID, user: username});
});

/* initial page setting */		
$(document).ready(function() {
	$('#settingPanel').hide();
	$('#textLimit').hide();
});