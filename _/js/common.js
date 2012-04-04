/**
 *	All the common functions
 *	(mostly jQuery extensions ...)
 */

(function($) {
	$.showError		= function( name, error ) {
		var c = $('<div>', { 'class': 'error' }).appendTo($('#messages'));
		$('<strong>').html(name).appendTo(c);
		c.append(error)
			.append($('<a>', { 'class' : 'close', href:'#' }).html('x')).fadeIn(400).delay(6000).fadeOut(400);
	};
	$.showSuccess	= function( name, success ) {
		var c = $('<div>', { 'class': 'success' }).appendTo($('#messages'));
		$('<strong>').html(name).appendTo(c);
		c.append(success)
			.append($('<a>', { 'class' : 'close', href:'#' }).html('x')).fadeIn(400).delay(6000).fadeOut(400);
	};
	$.showMessage	= function( name, message ) {
		var c = $('<div>', { 'class': 'message' }).appendTo($('#messages'));
		$('<strong>').html(name).appendTo(c);
		c.append(message)
			.append($('<a>', { 'class' : 'close', href:'#' }).html('x')).fadeIn(400).delay(6000).fadeOut(400);
	};
	$.showProgress	= function( name, message, id ) {
		var c = $('<div>', { 'class': 'message', 'id': id }).appendTo($('#messages'));
		$('<strong>').html(name).appendTo(c);
		c.append(message)
			.append($('<a>', { 'class' : 'close', href:'#' }).html('x')).fadeIn(400);
	};
	$.debug			= function( msg ) {
		//console.log( msg );
		//$('<p>').html(msg).appendTo($('#debug'));
	};
})(jQuery);