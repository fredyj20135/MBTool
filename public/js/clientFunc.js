var socket = io.connect('http://localhost:5092');
var username;
var windowAdj = false;
var highlightWord = '';
			
/* Socket.io function, start */
socket.on('connect', function() {
	$('#loginInput').bind('click', loginBtHandler);
	$(document).bind('keypress', loginBtEnterHandler);
});

socket.on('loginError', function(msg) {
	$('#loginMsg').text(msg);
});

socket.on('userConfirm', function(packet) {
	$('#loginMsg').text(packet.msg);
	$('#loginInput').unbind('click', loginBtHandler);
	$(document).unbind('keypress', loginBtEnterHandler);
	
	$("#loginBody").animate({opacity: 0, hight: 0}, 700, 'swing', function() {
		$("#loginBody").hide();
		$('#controlPanel').css('visibility', 'visible');
		$('#BSTBody').css('visibility', 'visible');
		$('#BSTBody').fadeIn('fast');
		$('#textInput').focus();
	});

	username = packet.uID;
});

/* distribute System Msg */ 
socket.on('serverSelfMsg', function(msg) { /* server msg related to user */
	$('#userMsgContainer').append($('<div>').text(msg).addClass('userMessage'));
});

socket.on('serverOthersMsg', function(msg) { /* server msg related to others */
	$('#partnerMsgContainer').append($('<div>').text(msg).addClass('partnerMessage'));
	$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop("scrollHeight"));
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
	var translateBt = $('<input>').addClass('translateBt').prop({type: 'button', value: ''});
	var revertBt 	= $('<input>').addClass('revertBt').prop({type: 'button', value: 'revert'}).hide();
	var timeStamp 	= $('<span>').addClass('timeStamp').html(postTime);
	var postID 		= $('<span>').addClass('postID').html(packet.pID).hide();
	var nameSpace 	= $('<span>').addClass('name').text(uID);
	var icon 		= $('<div>').addClass('partnerIcon').addClass(packet.uColor);
	
	content.html(content.html().replace(/\n/g, '<br>'));
	content = $('<span>').addClass('msgCntnt').append(content).append('<br>').append(likeBt).append(likeNum);

	if (uID == username) {
		content = content.append(shareBt).append(timeStamp);
		content = $('<div>').addClass('userMessage').append(postID).append(content);

		// var hidden = content.clone(); // for debug
		var hidden = content.clone().hide(); 

		if (!windowAdj) {
			$('#partnerMsgContainer').append(hidden);
			$('#userMsgContainer').append(content).scrollTop($('#userMsgContainer').prop('scrollHeight'));
		} else {
			$('#userMsgContainer').append(hidden);
			$('#partnerMsgContainer').append(content).scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
		}
		
	} else {
		content = content.append(nameSpace).append(timeStamp).append(translateBt).append(revertBt);
		content = $('<div>').addClass('partnerMessage').append(icon).append(postID).append(content);

		if (packet.block == true) content.find('.msgCntnt').addClass('block');

		$('#partnerMsgContainer').append(content).scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
	}
});

socket.on('partnerMsgBlock', function(packet){
	$('.partnerMessage').each(function(){
		if (!$(this).hasClass('share') && $(this).find('.name').text() == packet.uID) {
			if (packet.blockInfo == true) $(this).find('.msgCntnt').addClass('block');
			else $(this).find('.msgCntnt').removeClass('block');
		}
	});
	bubbleCtrl();
});

socket.on('partnerMsgShare', function(packet) { /* Share on the specific message */
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < partnerMsg.length; i++) {
		$(partnerMsg[i]).addClass('share');
		$(partnerMsg[i]).find('.msgCntnt').removeClass('block');	
	}

	bubbleCtrl()
});

socket.on('partnerMsgUnshare', function(packet) {
	var partnerMsg = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < partnerMsg.length; i++) {
		$(partnerMsg[i]).removeClass('share');
		if (packet.blockInfo == true) $(partnerMsg[i]).find('.msgCntnt').addClass('block');
	}

	bubbleCtrl()
});

socket.on('is BINDED', function(packet) { /* Get translated data and add to message */
	var result = $('<span>').addClass('trans').html(' (' + packet.toWord + ')');
	var transMsg = $(".postID:contains('" + packet.pID + "')").parent();

	result = $('<span>').addClass('highlight').prop('title', 'By ' + packet.uID).html(packet.fromWord).append(result);

	for (var i = 0; i < transMsg.length; i++) {
		var transMsgTxt = $(transMsg[i]).find('.msgTxt');

		if (transMsg.hasClass('partnerMessage')) {
			transMsg.find('.revertBt').show();
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
	if (index < 0) return oriHTML;

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

/* when others block their msgs, redraw element in partnerMsgContainer */
function bubbleCtrl() {
	if($('#hideUnshare').hasClass('clicked')) {
		$('.partnerMessage').each(function() { 
			if ($(this).find('.msgCntnt').hasClass('block')) $(this).hide('slow');
			else $(this).show('slow');
		});
	} else $('.partnerMessage').each(function(){ $(this).show('slow'); });

	$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop("scrollHeight"));
}

function loginBtHandler() {
	socket.emit('login', {usr: $('#username').val(), pwd: $('#pwd').val()});
	$('#username').val('');
	$('#pwd').val('');
}

function loginBtEnterHandler(event) {
	if (event.which == 13) $('#loginInput').click();
}

function windowCtrlBtHandler() { // animation still improvable
	if ($('#windowCtrlBt').hasClass('clicked')) {
		$('#windowCtrlBt').text('To two columns');
		windowAdj = true;

		$('#userMsgContainer .userMessage').each(function() { $(this).hide('slow'); });
		$(function () {
			$('#windowCtrlBt').prop('disabled', true);
			$("#userMsgContainer").animate({ width: '0%' }, { duration: 600, queue: true });
			$("#partnerMsgContainer").animate({ width: '100%' }, { duration: 600, queue: true, complete: function() {
      			$('#windowCtrlBt').prop('disabled', false);
    		}});
		});

		$('#partnerMsgContainer .userMessage').each(function() { $(this).show('fast'); });
	} else {
		$('#windowCtrlBt').text('To one column');
		windowAdj = false;

		$('#partnerMsgContainer .userMessage').each(function() { $(this).hide('slow'); });
		$(function () { 
			$('#windowCtrlBt').prop('disabled', true);
			$("#userMsgContainer").animate({ width: '50%' }, { duration: 600, queue: true });
			$("#partnerMsgContainer").animate({ width: '50%' }, { duration: 600, queue: false, complete: function() {
      			$('#windowCtrlBt').prop('disabled', false);
    		}});
		});
		$('#userMsgContainer .userMessage').each(function() { $(this).show('fast'); });
	}
	$('#userMsgContainer').scrollTop($('#userMsgContainer').prop('scrollHeight'));
	$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
}

/* Buttons in controlPanel. Concept by Allie. Start */
function sendBtHandler() {
	socket.emit('chat message', $('#textInput').val());
	$('#textInput').val('');
}

function settingBtHandler() {
	if ($('#settingPanel').is(':visible')){
		$('#settingPanel').hide();
		$('#sendButton').show('slow');
		$('#textInput').show('slow');
	} else {
		$('#settingPanel').show('slow');
		$('#sendButton').hide('slow');
		$('#textInput').hide();
	}
}
/* end */

/* Buttons controling bubbles. Concept by Allie and Seraphina. Start */
function clickControl(elmt) {
	if (elmt.hasClass('clicked')) elmt.removeClass('clicked');
	else elmt.addClass('clicked');
}

/* Block message button*/
$('#blockAll').click(function() { 
	clickControl($(this));

	if ($(this).hasClass('clicked')) {
		socket.emit('blockMsg', true);
		$('.shareBt').each(function() { $(this).show(); });
	} else {
		socket.emit('blockMsg', false);
		$('.shareBt').each(function() { $(this).hide(); });
	}
});

$('#hideUnshare').click(function() { 
	clickControl($(this));
	bubbleCtrl();
});

/* Setting Button */
$('#settingBt').click(function() { clickControl($(this)); });

$('#windowCtrlBt').click(function() {
	clickControl($(this));
});

/* Like "partner's" message button */
$('#container').on('click', 'input.likeBt', function() { 
	var postID = $(this).parent().prev().text();
	var userMsg = $('.postID:contains("' + postID + '")').parent();

	for (var i = 0; i < userMsg.length; i++) {
		var likeBt = $(userMsg[i]).find('input.likeBt');
		clickControl(likeBt);
	}
	if (likeBt.hasClass('clicked')) socket.emit('likeMsg', postID);
	else socket.emit('dislikeMsg', postID);
});

/* Share "user's" message button*/
$('#container').on('click', 'input.shareBt', function() { 
	var temp = $(this).closest('.userMessage');
	var postID = temp.find('.postID').text();
	var userMsg = $('.postID:contains("' + postID + '")').parent();

	for (var i = 0; i < userMsg.length; i++) {
		var shareBt = $(userMsg[i]).find('input.shareBt');
		clickControl(shareBt);

		if (shareBt.hasClass('clicked')) $(userMsg[i]).addClass('share');
		else $(userMsg[i]).removeClass('share');
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
	}
});

/* Send revert request */
$('#container').on('click', 'input.revertBt', function () {
	var partnerMsg = $(this).closest('.partnerMessage');
	var postID = partnerMsg.find('.postID').text();

	socket.emit('ctrlLock', postID);
	socket.emit('revert', {pID: postID, user: username});
});

/* initial page setting */		
$( document ).ready(function() {
	$('#BSTBody').hide();
	$('#settingPanel').hide();

	$('#sendButton').bind('click', sendBtHandler);
	$('#settingBt').bind('click', settingBtHandler);
 	$('#windowCtrlBt').bind('click', windowCtrlBtHandler);

  	$(window).bind('beforeunload', function(){ return 'All messages will be droped if you leave or relaod this page. \n\nAre you sure?'; });
});