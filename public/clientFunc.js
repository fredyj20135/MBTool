var socket = io.connect('http://localhost:5092');
var username;
var highlightWord;
var partnerMsgBlock = true
			
/* Welcome and start */
socket.on('connect', function() {
	username = prompt('Who are you?');
	socket.emit('addMe', username);
	console.log(username);
});

/* distribute System Msg */ 
socket.on('serverSelfMsg', function(msg) { /* server msg related to user */
	$('#userMsgContainer').append($('<div>').text(msg).addClass('userMessage'));
});

socket.on('serverOthersMsg', function(msg) { /* server msg related to others */
	$('#partnerMsgContainer').append($('<div>').text(msg).addClass('partnerMessage'));
});

socket.on('partnerMsgLike', function(timeStamp) { /* set like */
	$('.userMessage:contains("' + timeStamp + '")').find('.likeBt').addClass('clicked');
});

socket.on('partnerMsgDislike', function(timeStamp) { /* Disliked */
	$('.userMessage:contains("' + timeStamp + '")').find('.likeBt').removeClass('clicked');
});

/* Manipulate chat message, distribute user's and partner's messages
 * msgPack : uid: USERNAME, msg: MESSAGE, sysTime: SYSTEM TIME */
socket.on('chat', function(packet) {
	var uid = packet.uid;
	var postTime = packet.sysTime;

	var msgContainer;

	var content = $('<span>').addClass('msgText').html(packet.msg.replace('\n', '<br>') + '<br>');
	var shareBt = $('<input>').addClass('shareBt').prop({type: 'button', value:''});
	var likeBt = $('<input>').addClass('likeBt').prop({type: 'button', value:''});
	var translateBtn = $('<input>').addClass('translateBt').prop({type: 'button', value: 'Translate'});
	var timeStamp = $('<span>').addClass('timeStamp').hide().html(postTime);

	content = $('<span>').addClass('msgContent').append(content).append(timeStamp);

	if (uid == username) {
		msgContainer = $('#userMsgContainer');
		content = content.append(shareBt).append(likeBt);
		content = $('<div>').addClass('userMessage').append(content);
	}else {
		msgContainer = $('#partnerMsgContainer');
		content = content.append(translateBtn).append(likeBt);
		content = $('<div>').addClass('partnerMessage').append(content);

		if (partnerMsgBlock == true) content.find('.msgContent').addClass('block');			
	}
	msgContainer.append(content);
	msgContainer.scrollTop(msgContainer.prop("scrollHeight"));
});

socket.on('partnerMsgBlock', function(block){
	partnerMsgBlock = block;
	$('.partnerMessage').each(function(){
		if ( !$(this).hasClass('share')) {
			if (partnerMsgBlock == true) $(this).find('.msgContent').addClass('block');
			else $(this).find('.msgContent').removeClass('block');
		}
	});
});

socket.on('partnerMsgShare', function(timeStamp) {
	var partnerMsg = $('.partnerMessage:contains("' + timeStamp + '")');
				
	if (partnerMsg.hasClass('share') ){
		partnerMsg.removeClass('share');
		partnerMsg.find('.msgContent').addClass('block');
	} else {
		partnerMsg.addClass('share');
		partnerMsg.find('.msgContent').removeClass('block');
	}
});

socket.on('is BINDED', function(input) { /* Get translated data and add to message */
	var replaceWord = input.fromWord + ' (' + input.toWord + ')';
	var transMsg = $(".msgContent:contains('" + input.timeStamp + "')").find('.msgText');
	var msgContainer = transMsg.parent();
	var scroll = msgContainer.scrollTop()

	transMsg.html(transMsg.html().replace(input.fromWord, '<span class="highlight">' + replaceWord + '</span>'));

	msgContainer.scrollTop(scroll);
});

/* inputArea related functions. Concept by Alice Chang. Start*/
function sendButtonHandler() {
	socket.emit('chat message', $('#textInput').val());
	$('#textInput').val('');
}

function clickControl(element) {
	if (element.hasClass('clicked')) element.removeClass('clicked');
   	else element.addClass('clicked');
}

/* Block message button*/
$('#blockAll').click(function() { 
	clickControl($(this));

	if ($(this).hasClass('clicked')) socket.emit('blockMsg', true);
	else socket.emit('blockMsg', false);
});

/* Like "partner's" message button */
$('#container').on('click', '.partnerMessage input.likeBt', function() { 
	clickControl($(this)); 

	var partnerMsgLike = $(this).closest('.partnerMessage');
	if ($(this).hasClass('clicked')) socket.emit('likeMsg', partnerMsgLike.find('.timeStamp').text());
	else socket.emit('dislikeMsg', partnerMsgLike.find('.timeStamp').text());
});

/* Share "user's" message button*/
$('#container').on('click', 'input.shareBt', function() { 
	clickControl($(this)); 

	var partnerMsgShare = $(this).closest('.userMessage')
	if ($(this).hasClass('clicked')) partnerMsgShare.addClass('share');				
	else partnerMsgShare.removeClass('share');
				
	socket.emit('shareMsg', partnerMsgShare.find('.timeStamp').text());
});
/* end */ 

/* Catch user highlighted word (for translate)*/
$('#container').on('mouseup', '.partnerMessage', function() {
	highlightWord = getSelText().toString();

	$('.partnerMessage').each( function(){ $(this).removeClass('selected'); });
	if (highlightWord != '') $('.partnerMessage:contains("'+ highlightWord +'")').addClass('selected');
});

/* Send translate request */
$('#container').on('click', 'input.translateBt', function() {
	var partnerMsg = $(this).closest('.partnerMessage');
	var transWord;

	if (highlightWord == '') transWord = partnerMsg.find('.msgText').text();
	else transWord = highlightWord;

	var transElement = {
		word: transWord, 
		timeStamp: partnerMsg.find('.timeStamp').text(),
		fromLanguage: $('#oriLang').val(), 
		toLanguage: $('#transLang').val() 
	}

	socket.emit('translate', transElement);
});

/* Specify highlighted words */ 
function getSelText() { 
	var txt = '';
	if (window.getSelection) {
		txt = window.getSelection();
	}else if (document.getSelection){
		txt = document.getSelection();
	}else if (document.selection) {
		txt = document.selection.createRange().text;
	}
	return txt;
}
			
$( document ).ready(function() {
  	$('#sendButton').bind('click', sendButtonHandler);
});