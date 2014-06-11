jQuery(function(){
	jQuery('.action-input').focus();
	jQuery('.tooltip-trigger').tooltip({
		placement: 'top',
		container: 'body'
	});
	var deadline = new Date(jQuery('span.time').data('date'));
	var timeContainer = jQuery('span.time');
	setInterval(function(){
		var diff = Math.floor((deadline.getTime()-Date.now())/1000);
		timeContainer.text(diff);
	}, 1000);
});

