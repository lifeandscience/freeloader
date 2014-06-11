var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var Group = mongoose.model('Group');
var auth = require('./auth');
var config = require('./config');
var _ = require('underscore');
var async = require('async');
var moment = require('moment');

// Pick an hour between 3PM and Midnight Eastern
// Configurable 
var pickDeadline = function(random){
	var now = moment();
	now.minutes(0);
	now.seconds(0);
	now.milliseconds(0);
	if(random){
		// 3PM = 15
		// Midnight = 24
		var randomHour = Math.floor(Math.random() * (24 - 15 + 1)) + 15;
		if(randomHour == 24){
			// It's midnight
			now.add(1, 'day');
			now.hours(0);
		}else{
			now.hours(randomHour);
		}
	}else{
		now.add(1, 'day');
		now.hours(0);
	}
	return now.toDate();
}

app.get('/nightly', auth.authorize(2, 10), function(req, res){
	
	// When the nightly script runs, we need to do the following:
	//  1 Ask the auth server for every experimonth and, for each: 
	//  2	Check for players here in this experimonth that don't exist in the list of players from the auth server.
	//  3		These are players who were unenrolled at the auth server in the past day. Set their action to 'walkaway', but also note that they shouldn't be re-grouped later
	//  4			(call them 'deserters')
	//  5	Find all the groups within this experimonth and, for each:
	//  6		Keep a handle on this group for later assessment
	//  7		Find players who chose to walkaway and remove them from their groups, but store them and the ID of their former group for later usage (call them 'walkaways')
	//  8		If every player chose to freeload, dissolve this group, reset each player's point value to zero (OR delete them?), and un-enroll them at the auth server (Trello Card #15)
	//  9			Also, store these now un-enrolled player  (call them 'moochers')
	// 10		Process the actions of the remaining players, handling investments and freeloading
	// 11		If this group has < 3 members, dissolve it
	// 12			(call the leftover members 'abandonees')
	// 13			For each walkaway that caused this group to be dissolved, remember the set of abandonees
	// 14	Check each player in the experimonth exists here in Freeloader and *doesn't* exist in 'deserters'
	// 15		If not, add them
	// 16			Also, note this collection (call them 'newbies')
	// 17	Now we have 'walkaways' (who should be added to groups, but not the group they were just in), 'newbies' who should be added to any group, and 'abandonees'
	// 18		If (there are more than 2 groups or the optimal number of groups is > 2 and there are enough walkaways + newbies to create a new group):
	// 19			Evenly allocate all abandonees across existing groups 
	// 20		Else: (i.e. (there are 2 groups and the optimal number of groups is 2 and the number of walkaways + the number of newbies is < 3) OR there is only 1 group  (and we expect 2+ groups total)
	// 21			Add all abandonees who came from the same group to one group (therefore this allows for one other group to add the walkaway to) 
	// 22
	// 23		While number of walkaways + number of newbies is > 3 AND the total number of groups is less than the optimal number (total number of players / 10):
	// 24			Create a new group with three walkaways (preferably) and/or newbies
	// 25		For each walkaway:
	// 26			Check the average size of all the groups
	// 27			Find a group which is smaller than average and that doesn't contain any abandonees related to this walkaway and add this walkaway to that group.
	// 28		For each newbie:
	// 29			Check the average size of all the groups
	// 30			Find a group which is smaller than average and add this newbie to that group
	// 31		For each deserter:
	// 32			Delete their player profile (therefore giving them a zero balance)
	// 33		For each moocher:
	// 34			Delete their player profile (therefore giving them a zero balance)
	// 35			Tell the auth server to un-enroll them from this experimonth


	//Turn verbose logging on/off
	var V = true;
	
	if(V) console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++");
	
	// 1 Ask the auth server for every experimonth and, for each ...
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){
		if(V) console.log('got experimonths: ', err, experimonths);
	
		//Run the nightly cron for each active experimonth
		async.eachSeries(experimonths, function(experimonth, nextMonth) {
			if(V) console.log("Now processing experimonth id: " + experimonth._id);

			var authServerUserMap = {};
			// Let's store this authServerUserMap in case we need it later
			_.each(experimonth.users, function(user){
				authServerUserMap[user._id.toString()] = user;
			});
			
			// Get currently known players in this experimonth:
			Player.find({ experimonth: experimonth._id }).exec(function(err, players){
				if(!_.isArray(players)){
					if(V) console.log('No players', err, players);
					players = [];
				}
				
				if(V) console.log('Found all players, total of: ', players.length);
				
				var enrolledPlayerMap = {},
					groupMap = {},
					deserters = [],
					walkaways = [],
					moochers = [],
					abandonees = [],
					newbies = [],
					groupWalkaways = {};
				// Let's store this playerMap in case we need it later
				_.each(players, function(player){
					enrolledPlayerMap[player.remote_user] = player;
					var group = player.group;
					if(group){
						group = group.toString();
					}else{
						group = 'null';
					}
					if(!groupMap[group]){
						groupMap[group] = {
							players: [],
							group: group
						};
					}
					groupMap[group].players.push(player);

					//  2	Check for players here in this experimonth that don't exist in the list of players from the auth server.
					if(!authServerUserMap[player.remote_user]){
						if(V) console.log('Found a player who was un-enrolled at the auth server (deserter): ', player);
						//  3		These are players who were unenrolled at the auth server in the past day. Set their action to 'walkaway', but also note that they shouldn't be re-grouped later
						//  4			(call them 'deserters')
						deserters.push(player);
						player.todaysAction = 'walkaway';
						
						// Tell the auth server that this player deserted
						auth.doAuthServerClientRequest('POST', '/api/1/events', {
							user: player.remote_user,
							experimonth: experimonth._id,
							client_id: process.env.CLIENT_ID,
							name: 'freeloader:didDesert',
							value: true
						}, function(err, body){
							// TODO: Do something with the result? Or maybe not?
						});
					}
				});
				
				var pickSmallestGroup = function(groupIDsToIgnore){
					if(!groupIDsToIgnore){
						groupIDsToIgnore = [];
					}
					if(V) console.log('Picking the smallest group while ignoring: ', groupIDsToIgnore);
					var smallest = Infinity;
					var smallestGroupDetails = null;
					_.each(groupMap, function(groupDetails, groupID){
						if(groupDetails.players.length < smallest && groupIDsToIgnore.indexOf(groupID) === -1){
							smallest = groupDetails.players.length;
							smallestGroupDetails = groupDetails;
						}
					});
					if(V) console.log('The smallest group is: ', smallestGroupDetails);
					return smallestGroupDetails ? smallestGroupDetails.group : null;
				};

				//  5	Find all the groups within this experimonth and, for each:
				Group.find({experimonth: experimonth._id}).exec(function(err, groups){
					if(!_.isArray(groups)){
						groups = [];
					}
					if(V) console.log('Found all existing groups within the experimonth: ', groups.length);

					var groupsToDissolve = [];
					async.each(groups, function(group, groupCallback){
						var groupID = group._id.toString();
						if(V) console.log('Checking on Group:', groupID);
						//  6		Keep a handle on this group for later assessment
						if(!groupMap[groupID]){
							groupMap[groupID] = {
								players: [],
								group: groupID
							};
						}

						//  7		Find players who chose to walkaway and remove them from their groups, but store them and the ID of their former group for later usage (call them 'walkaways')
						async.filter(groupMap[groupID].players, function(player, callback){
							var afterCheckingAction = function(){
								if(player.todaysAction == 'walkaway' && deserters.indexOf(player) === -1){
									if(V) console.log('Found a walkaway!', player.remote_user);
									walkaways.push(player);

									// Tell the auth server that this user walked away
									auth.doAuthServerClientRequest('POST', '/api/1/events', {
										user: player.remote_user,
										experimonth: experimonth._id,
										client_id: process.env.CLIENT_ID,
										name: 'freeloader:action',
										value: 'walkaway'
									}, function(err, body){
										// TODO: Do something with the result? Or maybe not?
										callback(false);
									});
									return;
								}
								return callback(true);
							}
							if(!player.todaysAction) {
								player.getDefaultAction(function(defaultAction){
									if(V) console.log('got default action for player:', player.remote_user, defaultAction);
									player.todaysAction = defaultAction;
									afterCheckingAction();
								});
							}else{
								afterCheckingAction();
							}
						}, function(players){
							groupMap[groupID].players = players;
						
							//  8		If every player chose to freeload, dissolve this group, reset each player's point value to zero (OR delete them?), and un-enroll them at the auth server (Trello Card #15)
							var allFreeloaders = _.every(groupMap[groupID].players, function(player){
								// Only pass this check if moocherPenaltyEnabled is on
								return config('moocherPenaltyEnabled', experimonth._id, false, true) && player.todaysAction == 'freeload';
							});
							if(allFreeloaders){
								if(V) console.log('This group had all freeloaders, so we\'re dissolving the group and adding these users to moochers');
								
								async.each(groupMap[groupID].players, function(player, playerCallback){
									// Tell the auth server that this group was full of moochers and we're dissolving the group
									auth.doAuthServerClientRequest('POST', '/api/1/events', {
										user: player.remote_user,
										experimonth: experimonth._id,
										client_id: process.env.CLIENT_ID,
										name: 'freeloader:allPlayersMoochedSoDissolvingGroup',
										value: groupID
									}, function(err, body){
										playerCallback(err);
									});
								}, function(err){
									//  9			Also, store these now un-enrolled player  (add them to 'moochers')
									moochers = moochers.concat(groupMap[groupID].players);

									// TODO: Dissolve the group
									// Perhaps:
									groupsToDissolve.push(group);
									delete groupMap[groupID];

									return groupCallback();
								});
								return;
							}

							// 10		Process the actions of the remaining players, handling investments and freeloading
							if(V) console.log('Handling the actions of players in this group.');
							var numInGroup = groupMap[groupID].players.length;
							var numInvesting = _.reduce(groupMap[groupID].players, function(memo, player){
								return memo + (player.todaysAction == 'invest' ? 1 : 0);
							}, 0);
							var amountInvested = numInvesting * config('pointsToInvest', experimonth._id);
							var dividend = (amountInvested * 2) / numInGroup;
							if(V) console.log('Total investment was ', numInvesting, 'players and therefore ', amountInvested, 'total. Dividends are therefore ', dividend, 'each, given', numInGroup, 'players.');
							
							async.each(groupMap[groupID].players, function(player, callback){
								player.balance += dividend;

								// Tell the auth server about this player's action
								auth.doAuthServerClientRequest('POST', '/api/1/events', {
									user: player.remote_user,
									experimonth: experimonth._id,
									client_id: process.env.CLIENT_ID,
									name: 'freeloader:action',
									value: player.todaysAction
								}, function(err, body){
									if(player.todaysAction == 'freeload'){
										// Player gets their uninvested principal in addition to the dividend.
										player.balance += config('pointsToInvest', experimonth._id);
										player.lastTake = config('pointsToInvest', experimonth._id) + dividend;
										player.notifyOfFreeload(dividend + config('pointsToInvest', experimonth._id), function(){
											// Tell the auth server about this player's earned points
											auth.doAuthServerClientRequest('POST', '/api/1/events', {
												user: player.remote_user,
												experimonth: experimonth._id,
												client_id: process.env.CLIENT_ID,
												name: 'freeloader:pointsEarned',
												value: dividend + config('pointsToInvest', experimonth._id)
											}, function(err, body){
												auth.doAuthServerClientRequest('POST', '/api/1/events', {
													user: player.remote_user,
													experimonth: experimonth._id,
													client_id: process.env.CLIENT_ID,
													name: 'freeloader:balance',
													value: player.balance
												}, function(err, body){
													player.lastAction = player.todaysAction;
													player.todaysAction = null;
													player.save(callback);
												});
											});
										});
									}else{
										player.lastTake = dividend;
										player.notifyOfInvestment(dividend, function(){
											// Tell the auth server about this player's earned points
											auth.doAuthServerClientRequest('POST', '/api/1/events', {
												user: player.remote_user,
												experimonth: experimonth._id,
												client_id: process.env.CLIENT_ID,
												name: 'freeloader:pointsEarned',
												value: dividend
											}, function(err, body){
												auth.doAuthServerClientRequest('POST', '/api/1/events', {
													user: player.remote_user,
													experimonth: experimonth._id,
													client_id: process.env.CLIENT_ID,
													name: 'freeloader:balance',
													value: player.balance
												}, function(err, body){
													player.lastAction = player.todaysAction;
													player.todaysAction = null;
													player.save(callback);
												});
											});
										});
									}
									return;
								});
							}, function(err){
								if(err && V) console.log("There was an error saving a player :(", err);

								// 11		If this group has < 3 members, dissolve it
								// 12			(call the leftover members 'abandonees')
								// 13			For each walkaway that caused this group to be dissolved, remember the set of abandonees
								if(groupMap[groupID].players.length < 3 && _.size(groupMap) > 1){
									async.each(groupMap[groupID].players, function(player, playerCallback){
										abandonees.push(player);
										
										// Tell the auth server about this group dissolving
										auth.doAuthServerClientRequest('POST', '/api/1/events', {
											user: player.remote_user,
											experimonth: experimonth._id,
											client_id: process.env.CLIENT_ID,
											name: 'freeloader:groupDissolvingDueToSize',
											value: groupID
										}, function(err, body){
											playerCallback();
										});
									}, function(err){
										// All the people in this group are now walkaways
										groupWalkaways[groupID] = groupMap[groupID].players;

										// TODO: Dissolve the group
										// Perhaps:
										groupsToDissolve.push(group);
										delete groupMap[groupID];

										return groupCallback();
									});
									return;
								}
								return groupCallback();
							}); // async.each(players)
						}); // async.filter(players)
					}, function(err){ // async.each(groups)
						if(err && V) console.log("There was an error iterating over a group", err);
						
						// 14	Check each player in the experimonth exists here in Freeloader and *doesn't* exist in 'deserters'
						var newUsers = _.filter(authServerUserMap, function(user, userID){
							if(V) console.log('Assessing if this player is new:', userID);
							if(V) console.log('New?', !enrolledPlayerMap[userID] ? 'YES' : 'NO');
							return !enrolledPlayerMap[userID];
						});
						var newbies = [];
						if(groupMap['null']){
							if(V) console.log('There were players found in the DB that had a null group, so those are our first newbies', groupMap['null'].players);
							newbies = groupMap['null'].players;
						}
						if(V) console.log('Found new users:', newUsers.length, 'from authServer, ', newbies.length, 'from un-grouped players in the DB (weird?)');
						async.each(newUsers, function(user, newUserCallback){
							// 15		If not, add them
							// 16			Also, note this collection (call them 'newbies')
							
							if(V) console.log('No matching players found for user id: ', user._id, 'Creating a new player.');
							matchingPlayer = new Player();
							matchingPlayer.remote_user = user._id;
							matchingPlayer.experimonth = experimonth._id;
							matchingPlayer.balance = config('startingPoints', experimonth._id);
							matchingPlayer.lastAction = matchingPlayer.todaysAction;
							matchingPlayer.todaysAction = null;
							matchingPlayer.save(function(err, newPlayer){
								if(err) console.log('Error saving new player: ', err);
								if(V) console.log('New Player saved!');
								
								newbies.push(newPlayer);
								newUserCallback(err);
							});
						}, function(err){
							if(err) console.log('Error iterating over new users: ', err);
							if(V) console.log('New users iterated!');
							
							// 17	Now we have 'walkaways' (who should be added to groups, but not the group they were just in), 'newbies' who should be added to any group, and 'abandonees'
							var optimalNumberOfGroups = Math.round(experimonth.users.length / 10);
							if(optimalNumberOfGroups < config('minimumNumberOfGroups', experimonth._id)){
								optimalNumberOfGroups = config('minimumNumberOfGroups', experimonth._id);
							}
							
							var placementMap = {};
							if(V) console.log('Dealing with ', abandonees.length, 'abandonees.');
							if(abandonees.length > 0){
								if(V) console.log('For reference, there are ', _.size(groupMap), 'groups and ', optimalNumberOfGroups, 'groups desired and ', walkaways.length, 'walkaways and ', newbies.length, 'newbies.');
								if(_.size(groupMap) > 2 || (optimalNumberOfGroups > 2 && (walkaways.length + newbies.length > config('minimumGroupSize', experimonth._id)))){
									// 18		If (there are more than 2 groups or the optimal number of groups is > 2 and there are enough walkaways + newbies to create a new group):
									// 19			Evenly allocate all abandonees across existing groups 
									_.each(abandonees, function(abandonee){
										var groupDetails = pickSmallestGroup([]);
										if(groupDetails){
											abandonee.group = groupDetails.group;
											placementMap[abandonee._id.toString()] = abandonee.group;
											
											// Tell the auth server about the new group assignment for this user
											auth.doAuthServerClientRequest('POST', '/api/1/events', {
												user: abandonee.remote_user,
												experimonth: experimonth._id,
												client_id: process.env.CLIENT_ID,
												name: 'freeloader:addedToGroup',
												value: abandonee.group.toString()
											}, function(err, body){
												// TODO: Do something with the result? Or maybe not?
											});

											abandonee.notifyOfNewGroupDueToAbandonment();

											abandonee.save(function(err){
												if(err) console.log('Error putting abandonee into existing group :(', groupDetails.group);
												else if(V) console.log('Abandonee put into existing group!', groupDetails.group);
											});
										}
									}); // _.each(abandonees)
								}else{
									// 20		Else: (i.e. (there are 2 groups and the optimal number of groups is 2 and the number of walkaways + the number of newbies is < 3) OR there is only 1 group  (and we expect 2+ groups total)
									// 21			Add all abandonees who came from the same group to one group (therefore this allows for one other group to add the walkaway to) 
									var placementMatchupMap = {};
									_.each(abandonees, function(abandonee){
										if(placementMatchupMap[abandonee.group]){
											// Another abandonee from the same group has already been placed somewhere.
											// Place this abandonee in the same group, leaving the other group for the walkaway player
											abandonee.group = placementMatchupMap[abandonee.group];
											placementMap[abandonee._id.toString()] = abandonee.group;
											abandonee.save(function(err){
												if(err) console.log('Error putting abandonee into existing group :(', groupDetails.group);
												else if(V) console.log('Abandonee put into existing group!', groupDetails.group);
											});
										}else{
											var smallestGroupDetails = pickSmallestGroup([]);
											placementMatchupMap[abandonee.group] = smallestGroupDetails.group;
											abandonee.group = smallestGroupDetails.group;
											placementMap[abandonee._id.toString()] = abandonee.group;
											abandonee.save(function(err){
												if(err) console.log('Error putting abandonee into existing group :(', groupDetails.group);
												else if(V) console.log('Abandonee put into existing group!', groupDetails.group);
											});
										}
										// Tell the auth server about the new group assignment for this user
										auth.doAuthServerClientRequest('POST', '/api/1/events', {
											user: abandonee.remote_user,
											experimonth: experimonth._id,
											client_id: process.env.CLIENT_ID,
											name: 'freeloader:addedToGroup',
											value: abandonee.group.toString()
										}, function(err, body){
											// TODO: Do something with the result? Or maybe not?
										});

										abandonee.notifyOfNewGroupDueToAbandonment();

									}); // _.each(abandonees)
								}
							} // abandonees.length > 0
							
							// Now that we're here, let's just handle the groupsToDissolve real fast
							async.each(groupsToDissolve, function(groupToDissolve, groupToDissolveCallback){
								groupToDissolve.remove(groupToDissolveCallback);
							}, function(err){
							
								// 22
								// 23		While number of walkaways + number of newbies is > 3 AND the total number of groups is less than the optimal number (total number of players / 10):
								if(V) console.log('Putting walkaways and newbies into new groups');
								// Should we make new groups?
								async.whilst(function(){
									if(V) console.log('Checking if we should create new groups:');
									if(V) console.log('Walkaways: ', walkaways.length, 'Newbies:', newbies.length, 'Minimum Group Size:', config('minimumGroupSize', experimonth._id), 'Number of Groups:', _.size(groupMap), 'Optimal number of groups:', optimalNumberOfGroups);
									return (walkaways.length > 0 || newbies.length > 0) && (_.size(groupMap) < 2 || ((walkaways.length + newbies.length > config('minimumGroupSize', experimonth._id)) && (_.size(groupMap) < optimalNumberOfGroups)));
								}, function(whilstCallback){
									// 24			Create a new group with three walkaways (preferably) and/or newbies
									
									if(V) console.log("Creating a new group");
									var group = new Group();
									group.experimonth = experimonth._id;
									group.save(function(err, group){
										if(err) console.log('error saving group: ', err);
										if(V) console.log("New group saved!");

										var groupID = group._id.toString();
										groupMap[groupID] = {
											players: [],
											group: groupID
										};

										var i = 0;
										async.whilst(function(){
											return i < config('minimumGroupSize', experimonth._id) && (walkaways.length > 0 || newbies.length > 0);
										}, function(callback){
											var player = null;
											if(V) console.log('looking for a player in the walkaways or newbies: ', walkaways.length, 'walkaways,', newbies.length, 'newbies');
											var wasWalkaway = false;
											if(walkaways.length > 0){
												player = walkaways.shift();
												wasWalkaway = true;
											}else if(newbies.length > 0){
												player = newbies.shift();
											}
											if(V) console.log('got player:', player);
											if(player){
												player.group = group._id;
												groupMap[groupID].players.push(player);
												i++;

												// Tell the auth server about the new group assignment for this user
												auth.doAuthServerClientRequest('POST', '/api/1/events', {
													user: player.remote_user,
													experimonth: experimonth._id,
													client_id: process.env.CLIENT_ID,
													name: 'freeloader:addedToGroup',
													value: player.group.toString()
												}, function(err, body){
													player.save(function(){
														if(wasWalkaway){
															player.notifyOfNewGroupDueToWalkaway(callback);
														}else{
															player.notifyOfNewGroupDueToNewbie(callback);
														}
													});
												});
											}else{
												if(V) console.log('Didn\'t find a player to add to the group!');
												callback('no valid player found to add to the group :(');
											}
										}, function(err){
											if(err) console.log('error while loading up the players into the group!', err);
											if(V) console.log('Done adding players to new group!');
											whilstCallback();
										});
									});
								}, function(err){
									if(V) console.log('Handling the rest of the walkaways (', walkaways.length, ')');
									// 25		For each walkaway:
									async.eachSeries(walkaways, function(walkaway, walkawayCallback){
										// 26			Check the average size of all the groups
										// 27			Find a group which is smaller than average and that doesn't contain any abandonees related to this walkaway and which isn't the group from which this player walked away from and add this walkaway to that group.
										var groupsToIgnore = [walkaway.group];
										var playersToAvoid = groupWalkaways[walkaway.group];
										_.each(playersToAvoid, function(player){
											if(placementMap[player._id.toString()]){
												groupsToAvoid.push(placementMap[player._id.toString()]);
											}
										});
										
										var smallestGroupDetails = pickSmallestGroup(groupsToIgnore);
										if(smallestGroupDetails){
											walkaway.group = smallestGroupDetails.group;
											placementMap[walkaway._id.toString()] = walkaway.group;

											// Tell the auth server about the new group assignment for this user
											auth.doAuthServerClientRequest('POST', '/api/1/events', {
												user: walkaway.remote_user,
												experimonth: experimonth._id,
												client_id: process.env.CLIENT_ID,
												name: 'freeloader:addedToGroup',
												value: walkaway.group.toString()
											}, function(err, body){
												walkaway.notifyOfNewGroupDueToWalkaway(function(){
													walkaway.lastAction = 'walkaway';
													walkaway.todaysAction = null;
													walkaway.save(function(err){
														if(err) console.log('Error putting walkaway into existing group :(', smallestGroupDetails.group);
														else if(V) console.log('Walkaway put into existing group!', smallestGroupDetails.group);
														walkawayCallback(err);
													});
												});
											});
										}else{
											console.log('Error putting walkaway into existing group :(', groupsToIgnore, groupMap);
										}
									}, function(err){
										if(V) console.log('Handling the rest of the newbies (', newbies.length, ')');
										// 28		For each newbie:
										async.eachSeries(newbies, function(newbie, newbieCallback){
											// 29			Check the average size of all the groups
											// 30			Find a group which is smaller than average and add this newbie to that group
											
											var smallestGroupDetails = pickSmallestGroup([]);
											if(smallestGroupDetails){
												newbie.group = smallestGroupDetails.group;
												placementMap[newbie._id.toString()] = newbie.group;

												// Tell the auth server about the new group assignment for this user
												auth.doAuthServerClientRequest('POST', '/api/1/events', {
													user: newbie.remote_user,
													experimonth: experimonth._id,
													client_id: process.env.CLIENT_ID,
													name: 'freeloader:addedToGroup',
													value: newbie.group.toString()
												}, function(err, body){
													newbie.notifyOfNewGroupDueToNewbie(function(){
														newbie.lastAction = null;
														newbie.todaysAction = null;
														newbie.save(function(err){
															if(err) console.log('Error putting newbie into existing group :(', smallestGroupDetails.group);
															else if(V) console.log('Newbie put into existing group!', smallestGroupDetails.group);
															newbieCallback(err);
														});
													});
												});
											}else{
												console.log('Error putting newbie into existing group :(', [], groupMap);
											}
										}, function(err){
											if(V) console.log('Deleting all the deserters');
											// 31		For each deserter:
											async.each(deserters, function(deserter, deserterCallback){
												// 32			Delete their player profile (therefore giving them a zero balance)

												// Tell the auth server about the user's profile getting removed (balance reset)
												auth.doAuthServerClientRequest('POST', '/api/1/events', {
													user: deserter.remote_user,
													experimonth: experimonth._id,
													client_id: process.env.CLIENT_ID,
													name: 'freeloader:balanceReset',
													value: 'deserter'
												}, function(err, body){
													deserter.notifyOfDesertion(function(){
														deserter.remove(deserterCallback);
													});
												});
											}, function(err){
												if(V) console.log('Deleting and un-enrolling the moochers.');
												// 33		For each moocher:
												async.eachSeries(moochers, function(moocher, moocherCallback){
													// 34			Delete their player profile (therefore giving them a zero balance)
													// 35			Tell the auth server to un-enroll them from this experimonth

													auth.doAuthServerClientRequest('GET', '/api/1/experimonths/unenrollUser/'+experimonth._id+'/'+moocher.remote_user, null, function(err, experimonth){
														if(err){
															if(V) console.log('There was an error un-enrolling the user :(', err);
															moocherCallback(err);
															return;
														}

														// Tell the auth server about the user's profile getting removed (balance reset)
														auth.doAuthServerClientRequest('POST', '/api/1/events', {
															user: moocher.remote_user,
															experimonth: experimonth._id,
															client_id: process.env.CLIENT_ID,
															name: 'freeloader:balanceReset',
															value: 'moocher'
														}, function(err, body){
															moocher.notifyOfMooching(function(){
																moocher.remove(moocherCallback);
															});
														});
													});
												}, function(err){
													
													// Now that we're done with this Experimonth, let's set the num_players on each group.
													Group.find({experimonth: experimonth._id}).exec(function(err, groups){
														async.each(groups, function(group, callback){
															Player.count({group: group._id}).exec(function(err, playerCount){
																group.num_players = playerCount;
																group.deadline = pickDeadline(config('randomDeadline', experimonth._id, false, true));
																group.save(callback);
															});
														}, function(err){
															if(err) console.log('There was an error while updating num_players on each group', err);
															if(V) console.log('Finished with this month, moving to the next one.');
															// We've theoretically finished with this Experimonth.
															nextMonth(err);
														}); // async.each(groups)
													}); // Group.find

												}); // async.each(moochers)
											}); // async.each(deserters)
										}); // async.eachSeries(newbies)
									}); // async.eachSeries(walkaways)
								}); // async.whilst
							}); // async.each(groupsToDissolve)
						}); // async.each(newUsers)
					}); // async.each(groups)
					
				}); // Group.find().exec()
			}); // Player.find().exec()
		}, function(err) {
			if (err) {
				console.log("An error occurred trying to process the experimonths.");
			} else {
				console.log("All Experimonths have been processed. This job is complete.");  
			}
			res.redirect('/groups');
		}); // async.eachSeries(experimonths)
	}); // Auth Server Request for experimonths
});






