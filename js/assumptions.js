//This is where I define things so that when they don't exist we aren't
//greeted with 3000 errors or something ...

if ( undefined === typeof alert ) {			var alert		= function(){}; }
if ( undefined === typeof console ) {		var console		= {}; }
if ( undefined === typeof console.log ) {		console.log	= alert }

//and things I shouldn't be redefining, but will really hurt if they're not there:
if ( undefined === typeof openDatabase ) { alert('No Database available'); }
if ( undefined === typeof blackberry ) { alert('No BlackBerry API available.'); }