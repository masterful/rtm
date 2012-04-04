/**
 *	This houses the RTM object, which does all the grunt work for communicating with RTM
 */
var RTM	= {
	//"static" variables:
	_url			: 'https://api.rememberthemilk.com/services/rest/?'
	,_auth_url		: 'http://www.rememberthemilk.com/services/auth/?'
	, _auth_token	: ''
	, _key			: '92bafab75414024a2afee020f11fa5ca'
	, _secret		: '1050df75d36a4ba7'
	, authenticated	: false
	, user			: {}
	, num_synced	: 0

	//need this function to pass parameters properly ...
	, serialize	: function( obj ) {
		var a = [], i, o, sig, ser = '';
		//the keys need to be sorted:
		$.each(obj, function(i, o) {
			if ( obj.hasOwnProperty( i ) ) {
				a.push( i );
				ser	= ser + '&' + i + '=' + o;
			}
		});
		//sort!
		a.sort();
		//now string them together, after our secret, in alphabetical order
		sig		= this._secret;
		$.each(a, function(i, o) {
			sig	= sig + o + obj[o];
		});
		return 'api_sig=' + MD5(sig).toLowerCase() + ser;
	}

	//this will make all the calls, merging in the params with the ones we need
	, call		: function( params ) {
		var p	= {
			api_key		: this._key
			, callback	: 'RTM.test'
			, format	: 'json'
			, method	: 'rtm.test.echo'
		};
		if ( this._auth_token ) { p.auth_token	= this._auth_token; }
		$.extend(p, params);
		if ( 'function' === typeof p.callback ) {
			this.handlers.push(p.callback);
			p.callback	= 'RTM.handler';
		}
		//make the call:
		$('<script>', { type : 'text/javascript', src : this._url + this.serialize(p) })
			.appendTo($('head'));
	}
	//these two handle the callbacks
	, handlers	: []
	, handler	: function( data ) {
		if ( this.handlers.length ) {
			this.handlers.shift()(data);
		}
	}

	//two test functions to make sure we can make calls
	, test		: function( data ) {
		$.debug( data );
	}
	, echo		: function() {
		this.call({ name : 'Pim' });
	}

	//authenticate
	, authenticate	: function( stage, callback ) {
		var self	= this;
		switch( stage ) {
		case 'use_frob':
			$.debug('using frob');
			//do we have a frob?
			db.select('rtm_frob', {}, { 'ORDER BY' : 'id DESC', 'LIMIT' : '1' }, function(tx, rs) {
				if ( 1 > rs.rows.length ) {
					//no frob - so we need to get a new one
					self.authenticate('new_token', callback);
				}else{
					var frob	= rs.rows.item(0);
					self.call({
						method			: 'rtm.auth.getToken'
						, frob			: frob.value
						, perms			: 'delete'
						, 'callback'	: function( data ) {
							if ("ok" !== data.rsp.stat) {
								//hmm - perhaps a bad frob, just try getting a new one
								self.authenticate('new_token', callback);
								return;
							}
							self.user	= data.rsp.auth.user;
							db.insert('rtm_token', { frob_id: frob.id, value: data.rsp.auth.token, valid: 1 }, function(tx, rs) {
								//successfully saved their token
								//check the user id
								db.select('setting', { name: 'u_id' }, {}, function( tx, rs ) {
									if ( 1 > rs.rows.length ) {
										//no problem, the user doesn't yet exist, create them
										db.insert('setting', { name: 'u_id', value: user.id } );
									}else{
										//does the id match?
										if ( user.id !== rs.rows.item(0).value ) {
											//wipe the database clean of all sensitive data
											db.wipe( function(tx, rs) {
												//insert the new id after
												db.insert('setting', { name: 'u_id', value: user.id } );
											});
										}
									}
								});
							});
							self.authenticated		= true;
							self._auth_token		= data.rsp.auth.token;
							if ( callback ) { callback(); }
						}
					});
				}
			});
			break;
		case 'new_token':
			$.debug('need a new frob');
			//make a call to RTM to get a frob
			//we'll need a callback:
			self.call({
				method			: 'rtm.auth.getFrob'
				, 'callback'	: function( data ) {
					if ("ok" !== data.rsp.stat) {
						$.showError("Couldn't authenticate with RTM");
						return;
					}
					//insert frob into database, and display link
					db.insert('rtm_frob', { value: data.rsp.frob }, function(tx, rs) {
						//make 2 links on page:
						$('#modals').append(
							$('<div>',{'class':'modal'}).append(
								'<p>It looks like you haven\'t yet authenticated this application. Please</p>' +
								'<a class="centered external button" href="' + self._auth_url + self.serialize({
										api_key	: self._key
										, perms	: 'delete'
										, frob	: data.rsp.frob
									}) + '">authorize</a>' +
								'<p>this application using your web browser.</p>' +
								'<p>Then come back here and tell me when you\'re</p>'
							).append(
								$('<a>', { 'class': 'centered button', href: '#' }).on('click', function(e) {
									e.preventDefault();
									$( this ).parents('#modal').trigger('click');
									self.authenticate('use_frob', callback);
								}).html('done')
							).append(
								'<p>Did you read the <a href="http://vermeyden.com/rtm_privacy_policy.html" class="external">privacy policy</a>?</p>'
							)
						).fadeIn(300);
					});
				}
			});
			break;
		default:
			$.debug('default, first check for new token');
			//do we have a token?
			db.select('rtm_token'
					, {'valid' : '1'}
					, { 'ORDER BY' : 'id DESC', 'LIMIT' : '1' }
					, function(tx, rs) {
				var token	= ( rs.rows.length ) ? rs.rows.item(0) : null;
				if ( token ) {
					//we'll need a callback:
					//test the token first
					self.call({
						method			: 'rtm.auth.checkToken'
						, auth_token	: token.value
						, 'callback'	: function( data ) {
							if ( "ok" === data.rsp.stat ) {
								//we're authenticated
								self.user			= data.rsp.auth.user;
								self.authenticated	= true;
								self._auth_token	= data.rsp.auth.token;
								if ( callback ) { callback(); }
							}else{
								//invalidate this token
								db.update('rtm_token', token, { valid : 0 });
								//get new token
								self.authenticate('new_token', callback);
							}
						}
					});
				}else{
					//first try for a frob (maybe they accidentally closed the modal?)
					self.authenticate('use_frob', callback);
				}
			});
		}
	}

	//synchronize
	, synchronize	: function( item, callback ) {
		var self	= this;
		switch( item ) {
		//lists
		case 'lists':
			$.debug('Sync lists');
			//process the synchronization records
				//for each record, we need to see if it's changed online since we made our modification
				//if it has, use the online version (ignore atm, it will get overwritten in the next part)
				//if it's the same, then push the update to online
			//now, overwrite whatever we have in the local DB
			self.call({
				method			: 'rtm.lists.getList'
				, last_sync		: self.last_sync
				, 'callback'	: function( data ) {
					if ( "ok" !== data.rsp.stat ) {
						$.showError( "Error synchronizing lists: " + data.rsp.err.code );
					}else if (data.rsp.lists && data.rsp.lists.list) {
						if ( ! $.isArray(data.rsp.lists.list) ) {
							//for some reason, if there's only one result, it's always returned as an object
							//but for any other number we get an array, so we'll just emulate an array:
							data.rsp.lists.list		= [data.rsp.lists.list];
						}
						//overwrite our local table with the new data:
						$.each(data.rsp.lists.list, function(i, o) {
							//since the column names are identical, I can insert like this:
							db.safeInsert('rtm_list', o);
							self.num_synced ++;
						});
					}
					if (callback) { callback(); }
				}
			});
			break;
		//tasks
		case 'tasks':
			$.debug('Sync tasks');
			//process the synchronization records
			//now, overwrite whatever we have in the local DB
			self.call({
				method			: 'rtm.tasks.getList'
				, last_sync		: self.last_sync
				, 'callback'	: function( data ) {
					if ( "ok" !== data.rsp.stat ) {
						$.showError( "Error synchronizing tasks: " + data.rsp.err.code );
					}else if (data.rsp.tasks && data.rsp.tasks.list) {
						//they're grouped by list
						if ( ! $.isArray(data.rsp.tasks.list) ) {
							//in case they only have one list (not likely)
							data.rsp.tasks.list		= [data.rsp.tasks.list];
						}
						//overwrite our local table with the new data:
						$.each(data.rsp.tasks.list, function(i, list) {
							//some of these don't have a task series ... so we'll skip those
							if ( ! list.taskseries ) { return; }
							if ( ! $.isArray(list.taskseries) ) {
								//and if there's only one taskseries
								list.taskseries		= [list.taskseries];
							}
							$.each(list.taskseries, function(i, taskseries) {
								if ( taskseries.rrule ) {
									$.extend( taskseries, {
										repeat_t		: taskseries.rrule.$t
										, repeat_every	: taskseries.rrule.every
									});
								}
								//insert the task series (since the column names are identical, this works:
								db.safeInsert( 'rtm_taskSeries', taskseries );
								//also - since this is part of a list, insert it into that table too
								//but, because we don't get updates to which tasks are in which lists, we
								//have to remove the other ones first
								db.trans( function(tx){ tx.executeSql(
									'DELETE FROM rtm_taskList WHERE taskseries_id=? AND smart=0'
									, [ taskseries.id ]
									, db.success, db.error ); });
								db.safeInsert( 'rtm_taskList', {
									taskseries_id	: taskseries.id
									, list_id		: list.id
									, smart			: '0'
								});
								//tags
								//have to remove the other ones first
								db.trans( function(tx){ tx.executeSql(
									'DELETE FROM rtm_tag WHERE taskseries_id=?'
									, [ taskseries.id ]
									, db.success, db.error ); });
								if ( ! $.isArray(taskseries.tags.tag)) {
									taskseries.tags.tag	= [taskseries.tags.tag];
								}
								$.each(taskseries.tags.tag, function(i, tag) {
									//insert each tag
									db.safeInsert('rtm_tag', { taskseries_id: taskseries.id, name: tag });
								});
								//notes
								//have to remove the other ones first
								db.trans( function(tx){ tx.executeSql(
									'DELETE FROM rtm_note WHERE taskseries_id=?'
									, [ taskseries.id ]
									, db.success, db.error ); });
								if ( taskseries.notes.note ) {
									if ( ! $.isArray(taskseries.notes.note)) {
										taskseries.notes.note	= [taskseries.notes.note];
									}
									$.each(taskseries.notes.note, function(i, note) {
										$.extend( note, { taskseries_id: taskseries.id, content: note.$t });
										//insert each tag
										db.safeInsert('rtm_note', note);
									});
								}
								//tasks :)
								if ( ! $.isArray(taskseries.task)) {
									taskseries.task	= [taskseries.task];
								}
								$.each(taskseries.task, function(i, task) {
									$.extend(task, { taskseries_id : taskseries.id });
									//insert each task
									db.safeInsert('rtm_task', task);
									self.num_synced++;
								});
							});
						});
					}
					if (callback) { callback(); }
				}
			});
			break;
		//locations
		case 'locations':
			//no synchronization on locations yet :)
			//so overwrite whatever we have in the local DB
			self.call({
				method			: 'rtm.locations.getList'
				, 'callback'	: function( data ) {
					if ( "ok" !== data.rsp.stat ) {
						$.showError( "Error synchronizing locations: " + data.rsp.err.code );
					}else if (data.rsp.locations) {
						//overwrite our local table with the new data:
						if ( ! $.isArray(data.rsp.locations.location) ) {
							data.rsp.locations.location	= [data.rsp.locations.location];
						}
						$.each(data.rsp.locations.location, function(i, location) {
							db.safeInsert('rtm_location', location);
							self.num_synced++;
						});
					}
					if (callback) { callback(); }
				}
			});
			break;
		//smart lists
		case 'smart_lists':
			//smart lists need some special handling because I don't feel like applying filters
			db.select('rtm_list', { smart: '1', deleted: '0', archived: '0' }, {}, function( tx, rs ) {
				if ( ! rs.rows.length ) {
					if (callback) { callback(); }
					return;
				}
				for (var i = 0; i<rs.rows.length; i++) {
					var l	= rs.rows.item(0);
					self.call({
						method			: 'rtm.tasks.getList'
						, last_sync		: self.sync_all
						, filter		: l.filter
						, 'callback'	: function( data ) {
							if ( "ok" !== data.rsp.stat ) {
								$.showError( "Error synchronizing smart list (" + l.name + "): " + data.rsp.err.code );
							}else if (data.rsp.tasks && data.rsp.tasks.list) {
								//because we don't get updates to which tasks are in which lists, we
								//have to remove the other ones first
								db.trans( function(tx){
									tx.executeSql(
										'DELETE FROM rtm_taskList WHERE smart=1 AND list_id=?'
										, [l.id]
										, db.success
										, db.error );
								});
								//smart lists have their stuff housed in multiple other lists:
								if ( ! $.isArray(data.rsp.tasks.list) ) {
									data.rsp.tasks.list		= [data.rsp.tasks.list];
								}
								//overwrite our local table with the new data:
								$.each(data.rsp.tasks.list, function(i, list) {
									//some of these don't have a task series ...
									if ( ! list.taskseries ) { return; }
									//and if there's only one, it's returned as an object:
									if ( ! $.isArray(list.taskseries) ) {
										list.taskseries		= [list.taskseries];
									}
									$.each(list.taskseries, function(i, taskseries) {
										db.safeInsert( 'rtm_taskList', {
											taskseries_id	: taskseries.id
											, list_id		: l.id
											, smart			: '1'
										});
										self.num_synced++;
									});
								});
							}
							if (callback) { callback(); }
						}
					});
				}
			}, function() { $.debug('failed here'); });
			break;
		case 'all':
			self.num_synced	= 0;
			//get last sync time:
			db.select('setting', { name: 'last_sync' }, {}, function(tx, rs) {
				//beginning of time (not really):
				//to prevent caching, change the time ...
				var d			= new Date();
				self.sync_all	= '1990-01-01T0' + (d.getHours()%10) +
												':' + (d.getMinutes()) +
												':' + (d.getSeconds()) + 'Z';
				if (rs.rows.length) {
					self.last_sync	= rs.rows.item(0).value;
				}else{
					self.last_sync	= self.sync_all;
				}
				self.synchronize('locations', function() {
					self.synchronize('lists', function() {
						self.synchronize('tasks', function() {
							self.synchronize('smart_lists', function() {
								//udpate database with latest sync time
								var d	= new Date()
								, date	= d.getFullYear()+'-'+
										((d.getMonth()<9)?'0':'')+(d.getMonth()+1)+'-'+
										((d.getDate()<10)?'0':'')+d.getDate()+'T'+
										((d.getHours()<10)?'0':'')+d.getHours()+':'+
										((d.getMinutes()<10)?'0':'')+d.getMinutes()+':'+
										((d.getSeconds()<10)?'0':'')+d.getSeconds()+'Z';
								db.safeInsert('setting', { name: 'last_sync', value: date });
								//give callback
								if ( callback ) { callback(); }
							});
						});
					});
				});
			});
			break;
		default:
			self.num_synced	= 0;
			//get last sync time:
			db.select('setting', { name: 'last_sync' }, {}, function(tx, rs) {
				//beginning of time (not really):
				//to prevent caching, change the time ...
				var d			= new Date();
				self.sync_all	= '1990-01-01T0' + (d.getHours()%10) +
												':' + (d.getMinutes()) +
												':' + (d.getSeconds()) + 'Z';
				if (rs.rows.length) {
					self.last_sync	= rs.rows.item(0).value;
				}else{
					self.last_sync	= self.sync_all;
				}
				self.synchronize('locations', function() {
					self.synchronize('lists', function() {
						self.synchronize('tasks', function() {
							//udpate database with latest sync time
							var d	= new Date()
							, date	= d.getFullYear()+'-'+
									((d.getMonth()<9)?'0':'')+(d.getMonth()+1)+'-'+
									((d.getDate()<10)?'0':'')+d.getDate()+'T'+
									((d.getHours()<10)?'0':'')+d.getHours()+':'+
									((d.getMinutes()<10)?'0':'')+d.getMinutes()+':'+
									((d.getSeconds()<10)?'0':'')+d.getSeconds()+'Z';
							db.safeInsert('setting', { name: 'last_sync', value: date });
							//give callback
							if ( callback ) { callback(); }
						});
					});
				});
			});
		}
	}
	//reload the page
	, reload		: function( which, callback ) {
		var self	= this;
		switch( which ) {
		case 'task':
			var months		= ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
								'September', 'October', 'November', 'December']
				, days		= ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
				, frequency	= { WEEKLY : 'week', DAILY : 'day', MONTHLY : 'month', YEARLY : 'year' }
				, query;
			db.trans( function(tx) { tx.executeSql(
				query = 'SELECT ts.*, t.*, t.id task_id ' +
				'FROM rtm_taskSeries ts' +
					' OUTER LEFT JOIN rtm_task t ON ts.id = t.taskseries_id ' +
				'WHERE t.id=?'
				, [$('#list li.selected').attr('data-id')]
				, function( tx, rs ) {
					//did we get a task?
					if ( ! rs.rows.length ) {
						$.showError('', 'Couldn\'t find that task.');
						if ( callback ) { callback(); }
						return;
					}
					var task	= rs.rows.item(0);
					db.select( 'rtm_tag', { taskseries_id : task.taskseries_id }, {}, function(tx, rs) {
						var tags	= rs.rows;
						db.select( 'rtm_location', { id : task.location_id }, {}, function(tx, rs) {
							var location	= (rs.rows.length) ? rs.rows.item(0) : '';
							db.select( 'rtm_note', { taskseries_id : task.taskseries_id }, {}, function(tx, rs) {
								var notes	= rs.rows
									, t;	//need to define this here
								//load in new selection
								$('#info').children().remove();
								$('<h1>').html( task.name ).appendTo($('#info'));
								$('<a>', {'class':'button complete', href:'#', 'data-id':task.task_id }).html('complete').appendTo($('#info'));
								var dl	= $('<dl>').appendTo($('#info'));
								if ( task.due ) {
									var d	= new Date(task.due);
									d		= days[d.getDay()] + ', &nbsp;' +
												d.getDate() + ' &nbsp;' +
												months[d.getMonth()] + ' &nbsp;' +
												d.getFullYear() +
												((task.has_due_time)
													?' &nbsp; '+((d.getHours()%12)+1)+
														':'+((d.getMinutes()<10)?'0':'')+d.getMinutes()+
														' '+((12>d.getHours())?'am':'pm')
													:'');
									$('<dt>').html('Due').appendTo(dl);
									$('<dd>').html( d ).appendTo(dl);
								}
								if ( tags.length ) {
									t	= '';
									for ( var i = 0; i < tags.length; i ++ ) {
										t	= t + ', ' + tags.item(i).name;
									}
									$('<dt>').html('Tags').appendTo(dl);
									$('<dd>').html( t.substr(1) ).appendTo(dl);
								}
								if ( location ) {
									$('<dt>').html('Location').appendTo(dl);
									$('<dd>').html( location.name ).appendTo(dl);
								}
								if ( task.estimate ) {
									$('<dt>').html('Time').appendTo(dl);
									$('<dd>').html( task.estimate ).appendTo(dl);
								}
								dl	= $('<dl>').appendTo($('#info'));
								if ( task.repeat_every ) {
									t	= 'every '
										, s	= task.repeat_t.split(';')
										, f	= {};
									$.each(s, function(i, o) {
										var m	= o.split('=');
										f[m[0]]	= m[1];
									});
									t		= t + f.INTERVAL + ' ' + frequency[f.FREQ] + (('1' !== f.INTERVAL) ? 's':'');
									$('<dt>').html('Repeat').appendTo(dl);
									$('<dd>').html( t ).appendTo(dl);
								}
								if ( task.url ) {
									$('<dt>').html('URL').appendTo(dl);
									$('<dd>').append($('<a>', { href: task.url, 'class': 'external'}).html(task.url)).appendTo(dl);
								}
								if ( task.postponed ) {
									$('<dt>').html('Postponed').appendTo(dl);
									$('<dd>').html( task.postponed + ' time' + ((1!==task.postponed)?'s':'') ).appendTo(dl);
								}
								if ( notes.length ) {
									dl		= $('<dl>').appendTo($('#info'));
									$('<dt>').html('Notes').appendTo(dl);
									for ( var j = 0; j < notes.length; j ++ ) {
										var note	= notes.item(j);
										da			= new Date(note.modified);
										da			= da.getDate() + ' ' +
														months[da.getMonth()] + ' ' +
														da.getFullYear() + ', '+
														((da.getHours()%12)+1)+
																':'+((da.getMinutes()<10)?'0':'')+da.getMinutes()+
																' '+((12>da.getHours())?'am':'pm');
										$('<span>', { 'class' : 'date' }).html( da ).appendTo($('#info'));
										if (note.title) { $('<h2>').html( note.title ).appendTo($('#info')); }
										$('<p>').html( note.content ).appendTo($('#info'));
									}
								}
								//callback when we finish
								if ( callback ) { callback(); }
							});
						});
					});
				}, function() { $.debug(query); } );
			});
			break;
		case 'list':
			//save current selection
			var cur			= $('#list li.selected').attr('data-id')
				, suffix	= ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
			months			= ['January', 'Feb', 'March', 'April', 'May', 'June', 'July', 'August', 'Sept', 'Oct', 'Nov', 'Dec'];
			days			= ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			db.trans( function(tx) { tx.executeSql(
				query = 'SELECT ts.*, t.*, t.id task_id ' +
				'FROM rtm_taskList tl' +
					' JOIN rtm_task t ON (' +
						' tl.taskseries_id = t.taskseries_id AND' +
						' t.completed = \'\' AND' +
						' t.deleted = \'\'' +
						')' +
					' JOIN rtm_taskSeries ts ON t.taskseries_id = ts.id ' +
				'WHERE tl.list_id=? ' +
				'ORDER BY t.priority ASC, t.due ASC'
				, [$('#lists li.selected').attr('data-id')]
				, function( tx, rs ) {
					//load in new selection
					$('#list ul').children().remove();
					$('#info').children().remove();
					for ( var i = 0; i < rs.rows.length; i ++ ) {
						var task	= rs.rows.item(i)
							, today	= new Date()
							, due	= new Date(task.due)
							, d		= 24*60*60*1000
							, isdue	= today > (due-1*d)	//due within 24 hours
							, li	= $('<li>', { 'data-id': task.task_id }).appendTo($('#list ul'))
							, a		= $('<a>', { href: '#' }).appendTo(li);
						if (isdue) { li.addClass('is-due'); }
						$('<span>', { 'class' : 'priority priority-' + task.priority }).appendTo(a);
						$('<span>', { 'class' : 'task' }).html( task.name ).appendTo(a);
						if ( isdue && due.getDate() === today.getDate() ) {
							$('<span>', { 'class' : 'due-date' }).html( 'today' ).appendTo(a);
						}else if ( isdue && today < due ) {
							$('<span>', { 'class' : 'due-date' }).html( 'tomorrow' ).appendTo(a);
						}else if ( isdue ) {
							$('<span>', { 'class' : 'due-date' }).html( 'overdue' ).appendTo(a);
						}else if ( today > (due - 6*d)) {
							$('<span>', { 'class' : 'due-date' }).html( days[due.getDay()] ).appendTo(a);
						}else if ( today > (due - 13*d) ) {
							var day	= due.getDate();
							$('<span>', { 'class' : 'due-date' }).html( day + ((10<day&&day<20) ? 'th' : suffix[day%10])).appendTo(a);
						}else if ( due.getMonth() ) {
							$('<span>', { 'class' : 'due-date' }).html( months[due.getMonth()] ).appendTo(a);
						}
					}
					if ( ! rs.rows.length ) { $('#info').append('<p>(Cricket, cricket ... there\'s nothing here)</p>'); }
					//re-click the item we'd selected from before
					$('#list li[data-id=' + cur + ']').trigger('click');
					if ( callback ) { callback(); }
				});
			});
			break;
		case 'numbers':
			var d		= new Date((new Date() - 1))
				, date	= d.getFullYear()+'-'+
							((d.getMonth()<9)?'0':'')+(d.getMonth()+1)+'-'+
							((d.getDate()<10)?'0':'')+d.getDate()+'T'+
							((d.getHours()<10)?'0':'')+d.getHours()+':'+
							((d.getMinutes()<10)?'0':'')+d.getMinutes()+':'+
							((d.getSeconds()<10)?'0':'')+d.getSeconds();
			db.trans(function(tx){ tx.executeSql(
				'SELECT l.*, COUNT(t.id) due ' +
				'FROM rtm_list l' +
					' OUTER LEFT JOIN rtm_taskList tl ON l.id = tl.list_id' +
					' OUTER LEFT JOIN rtm_taskSeries ts ON tl.taskseries_id = ts.id' +
					' OUTER LEFT JOIN rtm_task t ON (' +
						' ts.id = t.taskseries_id AND' +
						' t.due < ? AND' +
						' t.due != \'\' AND' +
						' t.completed = \'\' AND' +
						' t.deleted = \'\'' +
						')' +
				'WHERE l.archived=0 AND l.deleted=0 ' +
				'GROUP BY l.id ' +
				'ORDER BY l.smart ASC, l.sort_order ASC, l.position ASC'
				, [ date ]
				, function( tx, rs ) {
					for ( var i = 0; i < rs.rows.length; i ++ ) {
						var list	= rs.rows.item(i)
							, li	= $('#lists li[data-id=' + list.id + ']')
							, due	= li.find('.number');
						if (1 > due.length) {due		= $('<div>', { 'class': 'number' }).prependTo(li); }
						due.attr('title',list.due).html(list.due);
						if (1 > parseInt(list.due, 1)) { due.remove(); }
					}
					if ( callback ) { callback(); }
				});
			});
			break;
		//case 'lists':
		default:
			//save current selection
			cur		= $('#lists li.selected').attr('data-id');
			d		= new Date((new Date() - 1));
			date	= d.getFullYear()+'-'+
							((d.getMonth()<9)?'0':'')+(d.getMonth()+1)+'-'+
							((d.getDate()<10)?'0':'')+d.getDate()+'T'+
							((d.getHours()<10)?'0':'')+d.getHours()+':'+
							((d.getMinutes()<10)?'0':'')+d.getMinutes()+':'+
							((d.getSeconds()<10)?'0':'')+d.getSeconds();
			db.trans(function(tx){ tx.executeSql(
				'SELECT l.*, COUNT(t.id) due ' +
				'FROM rtm_list l' +
					' OUTER LEFT JOIN rtm_taskList tl ON l.id = tl.list_id' +
					' OUTER LEFT JOIN rtm_taskSeries ts ON tl.taskseries_id = ts.id' +
					' OUTER LEFT JOIN rtm_task t ON (' +
						' ts.id = t.taskseries_id AND' +
						' t.due < ? AND' +
						' t.due != \'\' AND' +
						' t.completed = \'\' AND' +
						' t.deleted = \'\'' +
						')' +
				'WHERE l.archived=0 AND l.deleted=0 ' +
				'GROUP BY l.id ' +
				'ORDER BY l.smart ASC, l.sort_order ASC, l.position ASC'
				, [ date ]
				, function( tx, rs ) {
					//load in new selection
					$('#lists ul').children().remove();
					$('#list ul').children().remove();
					$('#info').children().remove();
					for ( var i = 0; i < rs.rows.length; i ++ ) {
						var list	= rs.rows.item(i)
							, li	= $('<li>', { 'data-id': list.id });
						if (list.due) {$('<div>', { 'class': 'number', 'title': list.due }).html(list.due).appendTo(li); }
						$('<a>', { href: '#' }).html( list.name ).appendTo(li);
						li.appendTo($('#lists ul'));
					}
					//re-click the item we'd selected from before
					$('#lists li[data-id=' + cur + ']').trigger('click');
					if ( callback ) { callback(); }
				});
			});
		}
	}
	, complete		: function( task_id, callback ) {
		var self	= this;
		db.trans( function(tx) { tx.executeSql(
			'SELECT t.*, tl.*' +
			' FROM rtm_task t' +
				' JOIN rtm_taskList tl ON (tl.taskseries_id = t.taskseries_id AND tl.smart = 0)' +
			' WHERE t.id = ?'
			, [task_id]
			, function( tx, rs ) {
				//did we get a task?
				if ( ! rs.rows.length ) {
					if (callback) { callback(); }
					$.showError('', 'Task not found.');
					return;
				}
				//otherwise:
				var task	= rs.rows.item(0);
				//mark the online as completed, for that we need a timeline
				self.call({
					method			: 'rtm.timelines.create'
					, 'callback'	: function( data ) {
						if ( "ok" !== data.rsp.stat || ! data.rsp.timeline ) {
							if (callback) { callback(); }
							$.showError('', 'Can\'t lock on the target.');
							return;
						}
						self.call({
							method			: 'rtm.tasks.complete'
							, timeline		: data.rsp.timeline
							, list_id		: task.list_id
							, taskseries_id	: task.taskseries_id
							, task_id		: task.id
							, 'callback'	: function( data ) {
								if ( "ok" !== data.rsp.stat || ! data.rsp.list.taskseries.task ) {
									if (callback) { callback(); }
									$.showError('', 'I\'m afraid I can\'t let you do that, ' + self.user.fullname + '.');
									return;
								}
								//mark as completed
								var date	= data.rsp.list.taskseries.task.completed;
								db.update( 'rtm_task', task, { completed: date }, function( tx, rs ) {
									if (callback) { callback(); }
								});
							}
						});
					}
				});
			}, db.error );
		});
	}
};