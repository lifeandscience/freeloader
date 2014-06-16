jQuery(function(){
	jQuery('.action-input:not(.submitted)').focus();

	jQuery('.tooltip-trigger').tooltip({
		trigger: 'click',
		placement: 'top',
		container: 'body'
	}).on('show.bs.tooltip', function(){
		var otherTips = jQuery('.tooltip-trigger').not(this).tooltip('hide');
	});
	
	var timeContainer = jQuery('span.time');
	var choiceMade = timeContainer.data('choice-made');
	if(choiceMade){
		timeContainer.text('Deadline Met');
	}else{
		var deadline = new Date(timeContainer.data('date'));
		var interval = setInterval(function(){
			var seconds = Math.floor((deadline.getTime()-Date.now())/1000);
			if(seconds < 0){
				timeContainer.text('00:00:00');
				clearInterval(interval);
				return;
			}
			var hours = Math.floor(seconds / (60 * 60));
			if(hours < 10){
				hours = '0'+hours;
			}
			seconds = seconds % (60 * 60);
			var minutes = Math.floor(seconds / 60);
			if(minutes < 10){
				minutes = '0'+minutes;
			}
			seconds = seconds % 60;
			if(seconds < 10){
				seconds = '0'+seconds;
			}
			var text = hours+':'+minutes+':'+seconds;
			timeContainer.text(text);
		}, 1000);
	}
});