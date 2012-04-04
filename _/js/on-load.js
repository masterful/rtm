$(function() {
	$('#modals').on('click', function(e) {
		if ( $(e.target).is($( this )) || $(e.target).hasClass('close') ) {
			$( this ).fadeOut( 200 ).children().remove();
		}
	});
	$('#messages').on('click', 'a.close', function(e) {
		e.preventDefault();
		$( this ).parent().remove();
	});
	$('#viewport').on('click', 'a.external', function( e ) {
		if ( ! blackberry ) {
			$( this ).attr('target', '_blank');
			return;
		}
		e.preventDefault();
		var ba	= new blackberry.invoke.BrowserArguments( $( this ).attr('href') );
		blackberry.invoke.invoke( blackberry.invoke.APP_BROWSER, ba );
	});
	$('#lists').on('click', 'a', function( e ) {
		e.preventDefault();
		if ( $( this ).parents('li').hasClass('selected') ) { return; }
		$( this ).parents('li').addClass('selected').siblings().removeClass('selected');
		RTM.reload('list', function() {
			$('#list a:first').trigger('click');
		});
	});
	$('#list').on('click', 'a', function( e ) {
		e.preventDefault();
		if ( $( this ).parents('li').hasClass('selected') ) { return; }
		$( this ).parents('li').addClass('selected').siblings().removeClass('selected');
		RTM.reload('task');
	});
	$('#buttons').on('click', 'a.reload', function( e ) {
		e.preventDefault();
		if ($(this).hasClass('loading')) { return; }
		$(this).addClass('loading');
		var self	 = this;
		RTM.synchronize('all', function() {
			$.showProgress('Synchronizing', '(' + RTM.num_synced + ' items)' +
					(RTM.num_synced>50?' This may take a while':''), 'sync_message');
			//reload page
			RTM.reload( 'lists', function() {
				if (1 > $('#lists li.selected').length) {
					$('#lists li:first').addClass('selected');
				}
				RTM.reload( 'list', function() {
					if (1 > $('#list li.selected').length) {
						$('#list li:first').addClass('selected');
					}
					RTM.reload( 'task', function() {
						$('#sync_message').fadeOut(700).delay(700).remove();
						$(self).removeClass('loading');
						//I know it's weird, but reloading the lists will get us our numbers
						RTM.reload( 'numbers' );
					});
				});
			});
		});
	})
		.on('click', 'a.add', function( e ) {
		e.preventDefault();
	});
	$('#info').on('click', 'a.complete', function( e ) {
		e.preventDefault();
		if ( $('#buttons .reload').hasClass('loading') ) {
			$.showError('', 'Please wait until the sync finishes first ...');
			return;
		}
		$('#buttons .reload').addClass('loading');
		RTM.complete( $( this ).attr('data-id'), function() {
			RTM.reload('list');
			RTM.reload('numbers');
		$('#buttons .reload').removeClass('loading');
		});
	});
	
	//don't sync right away - first load everything
	RTM.reload('lists', function() {
		$('#buttons a.reload').addClass('loading');
		$('#lists a:first').trigger('click');
		//check if they've authenticated
		RTM.authenticate( '', function() {
			$.showSuccess('','Welcome back, ' + RTM.user.fullname + '.');
			RTM.synchronize('all', function() {
				$.showProgress('Synchronizing', '(' + RTM.num_synced + ' items)' +
						(RTM.num_synced>50?' This may take a while':''), 'sync_message');
				//reload page
				RTM.reload( 'lists', function() {
					if (1 > $('#lists li.selected').length) {
						$('#lists li:first').addClass('selected');
					}
					RTM.reload( 'list', function() {
						if (1 > $('#list li.selected').length) {
							$('#list li:first').addClass('selected');
						}
						RTM.reload( 'task', function() {
							$('#sync_message').fadeOut(700).delay(700).remove();
							$('#buttons a.reload').removeClass('loading');
							//I know it's weird, but reloading the lists will get us our numbers
							RTM.reload( 'numbers' );
						});
					});
				});
			});
		});
	});
});