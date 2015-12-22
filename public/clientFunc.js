var socket = io.connect('http://localhost:5092');
var username;
var highlightWord = '';
			
/* Welcome and start */
socket.on('connect', function() {
	$('#loginInput').bind('click', loginBtHandler);
});

socket.on('loginError', function(msg) {
	$('#loginMsg').text(msg);
});

socket.on('userConfirm', function(msg) {
	$('#loginInput').unbind('click', loginBtHandler);
	
	$("#loginBody").animate({ opacity: 0, hight: 0}, 700, 'swing', function() {
		$("#loginBody").hide();
		$('#controlPanel').css('visibility', 'visible');
		$('#BSTBody').css('visibility', 'visible');
		$('#BSTBody').fadeIn('fast');
	});

	username = msg;
});

/* distribute System Msg. Start */ 
socket.on('serverSelfMsg', function(msg) { /* server msg related to user */
	$('#userMsgContainer').append($('<div>').text(msg).addClass('userMessage'));
});

socket.on('serverOthersMsg', function(msg) { /* server msg related to others */
	$('#partnerMsgContainer').append($('<div>').text(msg).addClass('partnerMessage'));
	$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop("scrollHeight"));
});

socket.on('partnerMsgLike', function(pID) { /* set like */
	var post = $('.postID:contains("' + pID + '")').parent();
	for (var i = 0; i < post.length; i++) $(post[i]).find('.likeBt').addClass('clicked');
});

socket.on('partnerMsgDislike', function(pID) { /* Disliked */
	var post = $('.postID:contains("' + pID + '")').parent();
	for (var i = 0; i < post.length; i++) $(post[i]).find('.likeBt').removeClass('clicked');
});

socket.on('revertMsg', function(packet) { /* Erase translation in specific bubbles, improvable! */
	var msgPool = $('.postID:contains("' + packet.pID + '")').parent();

	for (var i = 0; i < msgPool.length; i++) {
		var msgText = $(msgPool[i]).find('.msgTxt');
		var highlight = msgText.find('.highlight');
		var elmt, temp;
		var revertHTML = msgText.html();
	
		for (var j = 0; j < highlight.length; j++) { 
			elmt = $(highlight[j]);
			if (elmt != null && elmt.prop('title').slice(3, elmt.prop('title').length) == packet.user) {
				temp = elmt.clone();
				elmt.find('.trans:last').detach();
				revertHTML = revertHTML.replace(temp.prop('outerHTML'), elmt.html());
			}
		}
		msgText.html(revertHTML);
	}
	if (packet.owner == username) socket.emit('ctrlUnlock', packet.pID);
});

/* Manipulate chat message, distribute user's and partner's messages
 * msgPack : uid: USERNAME, msg: MESSAGE, sysTime: SYSTEM TIME */
socket.on('chat', function(packet) {
	var uid = packet.uid;
	var postTime = packet.sysTime;

	var content 	= $('<span>').addClass('msgTxt').text(packet.msg).append('<br>');
	var shareBt 	= $('<input>').addClass('shareBt').prop({type: 'button', value: ''});
	var likeBt 		= $('<input>').addClass('likeBt').prop({type: 'button', value: ''});
	var translateBt = $('<input>').addClass('translateBt').prop({type: 'button', value: ''});
	var revertBt 	= $('<input>').addClass('revertBt').prop({type: 'button', value: 'revert'});
	var timeStamp 	= $('<span>').addClass('timeStamp').html(postTime);
	var postID 		= $('<span>').addClass('postID').hide().html(packet.pID);
	var nameSpace 	= $('<span>').addClass('name').text(uid);
	var icon 		= $('<div>').addClass('partnerIcon').addClass(packet.uColor); // temp setting
	
	content.html(content.html().replace(/\n/g, '<br>'));
	content = $('<span>').addClass('msgCntnt').append(content).append(likeBt);

	if (uid == username) {
		content = content.append(shareBt).append(timeStamp);
		content = $('<div>').addClass('userMessage').append(postID).append(content);

		// var hidden = content.clone(); // for debug
		var hidden = content.clone().hide();

		$('#userMsgContainer').append(content);
		$('#userMsgContainer').scrollTop($('#userMsgContainer').prop('scrollHeight'));
		$('#partnerMsgContainer').append(hidden); // user itself change mode, access a global var to determine show or not
	} else {
		content = content.append(nameSpace).append(timeStamp).append(translateBt).append(revertBt);
		content = $('<div>').addClass('partnerMessage').append(postID).append(icon).append(content);

		if (packet.block == true) content.find('.msgCntnt').addClass('block');

		$('#partnerMsgContainer').append(content);
		$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop('scrollHeight'));
	}
});

socket.on('partnerMsgBlock', function(block){
	$('.partnerMessage').each(function(){
		if (!$(this).hasClass('share')) {
			if (block == true) $(this).find('.msgCntnt').addClass('block');
			else $(this).find('.msgCntnt').removeClass('block');
		}
	});
	hideEmptyBubble();
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

	result = $('<span>').addClass('highlight').prop('title', 'By ' + packet.owner).html(packet.fromWord).append(result);

	for (var i = 0; i < transMsg.length; i++) {
		var transMsgTxt = $(transMsg[i]).find('.msgTxt');

		if (transMsg.hasClass('partnerMessage')) result.addClass('note');
		else if (transMsg.hasClass('userMessage')) result.addClass('warn');
		transMsgTxt.html(powerReplace(transMsgTxt.html(), packet.fromWord, result.prop('outerHTML')));
	}
	
	if (packet.owner == username) socket.emit('ctrlUnlock', packet.pID);
});
/* end */

/* Prevent translation in tag */
function powerReplace(oriHTML, fromWord, transResult) {
	var temp = '', outHTML = '';
	var inTag = false;
	var i = 0, j = 0;

	for (i = 0; i < oriHTML.length; i++) {
		if (oriHTML[i] === '<') inTag = true;

		if (inTag == true) temp = temp + '#';
		else temp = temp + oriHTML[i];

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
	return outHTML.toString();
}
/* when others block their msgs, redraw element in partnerMsgContainer */
function hideEmptyBubble() {
	if($('#hideUnshare').hasClass('clicked')) {
		$('.partnerMessage').each(function() { 
			if ($(this).find('.msgCntnt').hasClass('block')) $(this).hide('slow');
			else $(this).show('slow');
		});
	} else $('.partnerMessage').each(function(){ $(this).show('slow'); });

	$('#partnerMsgContainer').scrollTop($('#partnerMsgContainer').prop("scrollHeight"));
}

function loginBtHandler() {
	socket.emit('login', {usr: $('#username').val(), pwd: $('#pwd').val(), group: $('#groupSelect').val()});
	$('#username').val('');
	$('#pwd').val('');
}

function windowCtrlBtHandler() { // animation can be improved......
	if ($('#windowCtrlBt').hasClass('clicked')) {
		$('#partnerMsgContainer .userMessage').each(function() { $(this).show('slow'); });
		$('#userMsgContainer .userMessage').each(function() { $(this).hide('slow'); });
		$('#userMsgContainer').hide('slow');
	} else {
		$('#partnerMsgContainer .userMessage').each(function() { $(this).hide('slow'); });
		$('#userMsgContainer .userMessage').each(function() { $(this).show('slow'); });
		$('#userMsgContainer').show('slow');
	}
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

	if ($(this).hasClass('clicked')) socket.emit('blockMsg', true);
	else socket.emit('blockMsg', false);
});

$('#hideUnshare').click(function() { 
	clickControl($(this));
	hideEmptyBubble();
});

/* Setting Button */
$('#settingBt').click(function() {
	clickControl($(this));
});

$('#windowCtrlBt').click(function() {
	clickControl($(this));
});

/* Like "partner's" message button */
$('#container').on('click', '.partnerMessage input.likeBt', function() { 
	clickControl($(this));
	
	var partnerMsg = $(this).closest('.partnerMessage');
	var postID = partnerMsg.find('.postID').text();

	if ($(this).hasClass('clicked')) socket.emit('likeMsg', postID);
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

		if (shareBt.hasClass('clicked')) {
			$(userMsg[i]).addClass('share');
			socket.emit('shareMsg', postID);
		} else {
			$(userMsg[i]).removeClass('share');
			socket.emit('unshareMsg', postID);
		}
	}
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
	if (highlightWord == '') transWord = partnerMsg.find('.msgTxt').text();
	else transWord = highlightWord;

	var transElement = { 
		owner: username,
		word: transWord, 
		pID: postID,
		fromLanguage: $('#oriLang').val(), 
		toLanguage: $('#transLang').val()
	};
	socket.emit('translate', transElement);
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

  	// $(window).bind('beforeunload', function(){ return 'All messages will be lost if you leave or relaod this page. \n\nAre you sure?'; });
});