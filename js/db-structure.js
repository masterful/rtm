var _tables	= {
	rtm_taskSeries	: {
		name			: 'Task Series'
		, description	: 'The central table, houses the task series\''
		, columns		: {
			id				: 'INTEGER'
			, location_id	: 'INTEGER'
			, name			: 'TEXT'
			, source		: 'TEXT'
			, url			: 'TEXT'
			, repeat_t		: 'TEXT'
			, repeat_every	: 'TEXT'
			, created		: 'DATE'
			, modified		: 'DATE'
		}, key			: ['id']
	
	
	}, rtm_location	: {
		name			: 'Location'
		, description	: 'The locations where tasks are to be done'
		, columns		: {
			id				: 'INTEGER'
			, name			: 'TEXT'
			, latitude		: 'TEXT'
			, longitude		: 'TEXT'
			, address		: 'TEXT'
			, viewable		: 'BOOLEAN'
			, zoom			: 'INTEGER'
		}, key			: ['id']
	
	
	}, rtm_tag		: {
		name			: 'Tag'
		, description	: 'The different tags use to label the tasks'
		, columns		: {
			taskseries_id	: 'INTEGER'
			, name			: 'TEXT'
		}, key			: ['taskseries_id', 'name']
	
	
	}, rtm_note		: {
		name			: 'Note'
		, description	: 'Notes for task series (if they happen to have any)'
		, columns		: {
			id				: 'INTEGER'
			, taskseries_id	: 'INTEGER'
			, title			: 'TEXT'
			, content		: 'TEXT'
			, created		: 'DATE'
			, modified		: 'DATE'
		}, key			: ['id']
	
	
	}, rtm_taskList	: {
		name			: 'Task-List'
		, description	: 'The relationship table relating lists and task series\' together'
		, columns		: {
			taskseries_id	: 'INTEGER'
			, list_id		: 'INTEGER'
			, smart			: 'BOOLEAN'
		}, key			: ['taskseries_id','list_id']
	
	
	}, rtm_task		: {
		name			: 'Task'
		, description	: 'Where the tasks themselves are housed'
		, columns		: {
			id				: 'INTEGER'
			, taskseries_id	: 'INTEGER'
			, priority		: 'TEXT'
			, estimate		: 'TEXT'
			, postponed		: 'INTEGER'
			, has_due_time	: 'BOOLEAN'
			, due			: 'DATE'
			, completed		: 'DATE'
			, deleted		: 'DATE'
		}, key			: ['id']
	
	
	}, rtm_list		: {
		name			: 'List'
		, description	: 'The various lists we have (both smart and normal)'
		, columns		: {
			id				: 'INTEGER'
			, name			: 'TEXT'
			, smart			: 'BOOLEAN'
			, locked		: 'BOOLEAN'
			, archived		: 'BOOLEAN'
			, deleted		: 'BOOLEAN'
			, sort_order	: 'INTEGER'
			, position		: 'INTEGER'
		}, key			: ['id']
	
	
	}
	//and our own tables
	, rtm_frob		: {
		name			: 'Frob'
		, description	: 'Where we house the frob(s) we use(d) to communicate with RTM'
		, columns		: {
			id				: 'INTEGER'
			, value			: 'TEXT'
		}, key			: ['id']
	
	
	}, rtm_token	: {
		name			: 'Token'
		, description	: 'Where we keep the token(s) we use(d) to authenticate with RTM'
		, columns		: {
			id				: 'INTEGER'
			, frob_id		: 'INTEGER'
			, value			: 'TEXT'
			, valid			: 'BOOLEAN'
		}, key			: ['id']
	
	
	}, setting	: {
		name			: 'Setting'
		, description	: 'Where we hold on to our settings for future uses'
		, columns		: {
			name			: 'TEXT'
			, value			: 'TEXT'
		}, key			: ['name']
	}
};