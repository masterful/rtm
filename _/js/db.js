/**
 *	Woot - we have database functionality!
 */

var db	= {
	_title		: 'rtm'
	, _version	: '0.1'
	, _size		: 1000
	, _desc		: 'The Remember the Milk app!'
	, _tables	: _tables
	
	//open the connection to the DB and make all the tables if they don't yet exist
	, connect	: function() {
		this._conn			= openDatabase( this._title, this._version, this._desc, this._size );
		if ( ! this._conn ) { this.error( 'Uh oh' ); return; }
		var self			= this;
		//make all the tables exist!
		$.each(this._tables, function( table, info ) {
			self._conn.transaction( function( tx ) {
				var query	= 'CREATE TABLE IF NOT EXISTS ' + table + '('
					, cols	= ''
					, key	= '';
				$.each(info.columns, function( name, type ) {
					cols	= cols + ',' + name + ' ' + type;
				});
				if ( 0 < info.key.length ) {
					$.each(info.key, function( i, name ) {
						key	= key + ',' + name;
					});
					cols	= cols + ',PRIMARY KEY (' + key.substr(1) + ')';
				}
				query		= query + cols.substr(1) + ')';
				tx.executeSql(query, []);
			});
		});
	}
	//transaction wrapper
	, trans		: function( t ) {
		this._conn.transaction( t );
	}
	//default error handler
	, error		: function( tx, e ) {
		$.debug(e);
		$.showError( 'DB Problem', e.message );
	}
	//default success handler (empty)
	, success	: function( tx, rs ) {}
	//wipe the important tables
	, wipe		: function(callback) {
		var self	= this;
		self.trans(function(tx) {
			tx.executeSql('DELETE FROM ' + self._tables.setting);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_list);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_task);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_taskList);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_note);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_tag);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_location);
			tx.executeSql('DELETE FROM ' + self._tables.rtm_taskSeries);
		}, (callback) ? callback : self.success, self.error );
	}
	
	//generic update function:
	//@param	table	- the table we're updating
	//@param	item	- the row we gave them that they're updating (gives us the key)
	//@param	values	- the values we're updating (associative object)
	//@param	callback- the function to call when we're done updating
	, update	: function( table, item, values, callback ) {
		var	self	= this
			, query	= ''
			, key	= ''
			, info	= self._tables[table]
			, i, o, a = [];
		if ( ! info ) { return; }
		//build our array: (and query a little)
		$.each(values, function( i, o ) {
			if (info.columns.hasOwnProperty(i)) {
				query	= query + ',' + i + "=?";
				a.push(o);
			}
		});
		//build our array: (and query a little)
		$.each(info.key, function( i, o ) {
			key		= key + ' AND ' + o + "=?";
			a.push(item[o]);
		});
		if ( ! a.length ) {
			//no values to insert? don't insert
			$.debug('Yeah - you didn\'t give me anything to insert');
			if (callback) { callback(); }
			return;
		}
		//finish our query, don't worry about injection on the info (and "i") vars ...
		//this is a freakin' local sql table, if they really wanted to mess it up, they
		//needn't have to use my library for it
		query	= 'UPDATE ' + table + ' SET ' + query.substr(1) + ' WHERE ' + key.substr(5);
		self.trans(function(tx) {
			tx.executeSql(
				query
				, a
				, (callback) ? callback : self.success
				, function( tx, e ) {
					$.debug('Query failure: ' + query);
					$.debug(a);
					if (callback) { callback(); }
					self.error(tx, e);
				});
		});
	}
	//generic insert function:
	//see update function for explanation of params
	, insert	: function( table, values, callback ) {
		var	self	= this
			, query	= ''
			, val	= ''
			, info	= self._tables[table]
			, i, o, a = [];
		if ( ! info ) { return; }
		$.each(values, function( i, o ) {
			if (info.columns.hasOwnProperty(i)) {
				query	= query + ',' + i;
				val		= val	+ ',?';
				a.push(o);
			}
		});
		if ( ! a.length ) {
			//no values to insert? don't insert
			$.debug('Yeah - you didn\'t give me anything to insert');
			if (callback) { callback(); }
			return;
		}
		query	= 'INSERT INTO ' + table + ' (' + query.substr(1) + ') VALUES (' + val.substr(1) + ')';
		self.trans(function(tx) {
			tx.executeSql(
				query
				, a
				, (callback) ? callback : self.success
				, function( tx, e ) {
					$.debug('Query failure: ' + query);
					$.debug(a);
					if (callback) { callback(); }
					self.error(tx, e);
				});
		});
	}
	//safe insert function (uses update and falls back to insert):
	//see update function for explanation of params
	, safeInsert	: function( table, values, callback ) {
		var	self	= this
			, info	= self._tables[table]
			, query	= 'SELECT * FROM ' + table
			, key	= ''
			, a		= [];
		if ( ! info ) { return; }
		$.each(info.key, function( i, o ) {
			key		= key + ' AND ' + o + "=?";
			a.push(values[o]);
		});
		query		= query + ((info.key.length) ? ' WHERE ' + key.substr(5) : '');
		self.trans(function(tx) {
			tx.executeSql( query, a, function(tx, rs) {
				if (rs.rows.length) {
					self.update( table, values, values, callback );
				}else{
					self.insert( table, values, callback );
				}
			}, function( tx, e ) {
				$.debug('Query failure: ' + query);
				$.debug(a);
					if (callback) { callback(); }
				self.error(tx, e);
			});
		});
	}
	//generic select function:
	, select	: function( table, values, options, callback ) {
		var	self	= this
			, query	= ''
			, where	= ''
			, info	= self._tables[table]
			, i, o, a = [];
		if ( ! info ) { return; }
		$.each(values, function( i, o ) {
			if (info.columns.hasOwnProperty(i)) {
				where	= where + ' AND ' + i + "=?";
				a.push(o);
			}
		});
		query			= 'SELECT * FROM ' + table;
		if ( 0 < a.length ) {
			query		= query + ' WHERE ' + where.substr(5);
		}
		$.each(options, function( i, o ) {
			if (options.hasOwnProperty(i)) {
				query	= query + ' ' + i + ' ' + o;
			}
		});
		self.trans(function(tx) {
			tx.executeSql(
				query
				, a
				, (callback) ? callback : self.success
				, function( tx, e ) {
					$.debug('Query failure: ' + query);
					$.debug(a);
					if (callback) { callback(); }
					self.error(tx, e);
				});
		});
	}
};

//and open our connections
db.connect();