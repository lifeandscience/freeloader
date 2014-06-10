
var cache = {};

var defaults = {
	pointsToInvest: 1,
	startingPoints: 0,
	minimumNumberOfGroups: 2,
	minimumGroupSize: 3,
	defaultAction: 'freeload',
	walkawayEnabled: true,
	moocherPenaltyEnabled: false
};

module.exports = function(property, experimonthID, defaultValue){
	if(experimonthID){
		experimonthID = experimonthID.toString(); // Verify this is a string and not an ObjectID
	}else{
		experimonthID = 'none';
	}
	if(!cache[experimonthID]){
		cache[experimonthID] = {};
	}
	var value = cache[experimonthID][property];
	if(!value){
		// Check for the value in the process config that's specific to this EM
		if(process.env['config_'+experimonthID+'_'+property]){
			value = process.env['config_'+experimonthID+'_'+property];
		}else if(process.env['config__'+property]){
			// Check for the value in the process config as a global default
			value = process.env['config_'+property];
		}
	}
	if(value){
		// Found a value, so cache it
		cache[experimonthID][property] = value;
	}
	if(!value && defaultValue){
		// No value, so use the code-supplied default
		value = defaultValue;
	}
	// Check for absolute defaults here in this file:
	if(!value && defaults[property]){
		value = defaults[property];
	}
	return value;
}