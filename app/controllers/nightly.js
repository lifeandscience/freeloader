var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var Group = mongoose.model('Group');
var auth = require('./auth');
var config = require('./config');
var _ = require('underscore');
var async = require('async');


app.get('/nightly', auth.authorize(2, 10), function(req, res){

	//Turn verbose logging on/off
	var V = false;
	
	if(V) console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++");
	
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){
	
		//Run the nightly cron for each active experimonth
		async.eachSeries(experimonths, function(experimonth, nextMonth) {
			if(V) console.log("Now processing experimonth id: " + experimonth._id);
	
			//Check to see if each user has an associated player. 
			//Note: A single auth user has an associated player for each experimonth
			if(experimonth.users && experimonth.users.length) {
			
				if(V) console.log("See if we need to create any players for new users.");        
				async.eachLimit(experimonth.users, 5, function(user, nextUser) {
			        //Okay, let's try to find a matching player in this experimonth
					Player.find({ remote_user: user._id }).exec(function(err, players){
						var matchingPlayer = null;
						if(players && players.length){
							if(V) console.log("Found (" + players.length + ") potential players matching user id: " + user._id);
							_.each(players, function(player) {
								if(player.experimonth == experimonth._id.toString()) {
									matchingPlayer = player;
									nextUser();
								}		
							});
						}
						if(!matchingPlayer) {
							//We need to create the player because they do not exist yet.
							if(V) console.log("No matching players found for user id: " + user._id + ". Creating a new player.");
							matchingPlayer = new Player();
							matchingPlayer.remote_user = user._id;
							matchingPlayer.experimonth = experimonth._id;
							matchingPlayer.balance = config.startingPoints;
							matchingPlayer.save(function(err){
								if(err) console.log('Error saving new player: ', err);
								if(V) console.log("New Player saved!");
								nextUser(err);
							});
						}
					});
			        
			    }, function(err) {
			        if (err) return nextMonth(err);
			        if(V) console.log("Okay, all new players are saved!");
			        
			        
			        //Now that we have all of the latest players, do some more stuff (like create groups, calculate new balances, etc)
			        
			        
			        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
			        
			        //Get a list of all of the existing groups
					Group.find({ experimonth: experimonth._id }).exec(function(err, groups){
					
						var num_groups = 0;
						var GROUP_MAP = {};
						_.each(groups, function(group) {
							num_groups++;
							GROUP_MAP[group._id] = group;
						});
						if(V) console.log("There are (" + num_groups + ") existing groups for this Experimonth.");
					
						Player.find({ experimonth: experimonth._id }).exec(function(err, players){
						
							var num_players = 0;
							var new_players = []; //Players added today, not assigned a group yet.
							var players_leaving_group = [];
							_.each(players, function(player) {
								num_players++;
				
								//Special case where the assigned group does not exist anymore
								if(player.group && !GROUP_MAP[player.group]) {
									//Group does not exist anymore. Reset it.
									player.group = null;
								}
								
								// Find all new players without a group.
								if(!player.group) {
									new_players.push(player);
								}
								
								// Find all existing players who are leaving their group.
								if(player.group && player.todaysAction == "leavegroup") {
									players_leaving_group.push(player);
								}
							});
							if(V) console.log("There are (" + num_players + ") players for this Experimonth.");
				
							// Compute the total number of groups we need.
							var num_groups_needed = Math.ceil(num_players / 10);
				
							//Create more group(s) if needed
							if(num_groups_needed > num_groups) {
								if(V) console.log("Based on the number of players we have, we need to create (" + (num_groups_needed - num_groups) + ") new groups.");
								for(var x=num_groups; x < num_groups_needed; x++) {
									if(V) console.log("Creating a new group");
									var group = new Group();
									group.experimonth = experimonth._id;
									group.save(function(err){
										if(err){
											console.log('error saving group: ', err);
										}
										if(V) console.log("New group saved!");
									});	
									//Manually add our group the the groups array and group map
									groups.push(group);
									GROUP_MAP[group.id] = group;
									num_groups++;
								}
							}
				
							if(V) console.log("There are (" + new_players.length + ") new players that need a group.");
							if(V) console.log("There are (" + players_leaving_group.length + ") existing players that want to leave their group.");
							
							async.whilst(
							    function () {
							    	return (new_players.length || players_leaving_group.length); 
							    },
							    function (nextPass) {
							        async.eachLimit(groups, 5, function(group, nextGroup) {
					
										//Try to add a new player to this group
										if(new_players.length > 0) {
											var p = new_players.pop();
											p.group = group;
											group.num_players++;
										} else if(players_leaving_group.length > 0) {
										
											//No new players, try an existing player
											var p = players_leaving_group.pop();
											//Check to make sure this player isn't trying to leave this group.
											if(p.group.toString() == group._id.toString()) {
												//Push this player back onto the array since this is the same group. Will be assigned a new group later
												players_leaving_group.push(p);
											} else {
												//We're good. Update player counts and associate new group to player
												GROUP_MAP[p.group].num_players--; //user leaves old group	
												p.group = group._id;
												group.num_players++; //user joins new group
											}
										}
										group.save(function(err){
											if(err){
												console.log('Error saving group after updating num_player count: ', err);
												nextGroup(err);
											}
											//Now save the player, if applicable						
											if(p) {
												p.save(function(err){
													if(err){
														console.log('Error saving player after new group assignment: ', err);
													}
													nextGroup(err);
												});
											} else {
												nextGroup();
											}
										});
					
									}, function(err) {
								        if(err){
									    	console.log("An error occurred while trying to assign players to a group.");
								        } 
								        if(V) console.log("Finished pass of all groups looking for places to put users. Checking to see if another pass is needed.");
								        if(V) console.log("Remaining players to be assigned: " + new_players.length + " (new) and " + players_leaving_group.length + " (leaving)");
								        nextPass(err);
								    });
							    },
							    function (err) {
							    	if(err) {
								    	console.log("An error occurred while trying to process the list of players needing a new group.", err);
							    	}
							        if(V) console.log("Finished processing players that needed a group.");
							        
							        
							        // Check to see if any groups have less than 3 players. If they do, just delete them.
									// Note: If we have less than 15 total players, we will only have a single group so this does not apply.
									if(num_players > 15) {
										if(V) console.log("Check to see if any groups have less than 3 members. If so, remove that group and reassign players.");
										var eligibleGroups = [];
										_.each(groups, function(group, index) {
											if(group.num_players < 3) {
												//Delete this group (mongo, groups array, and GROUP_MAP)
												GROUP_MAP[group._id] = null;
												if(V) console.log("Removing a group with less than 3 members. Group ID: " + group._id + " and index: " + index);
												group.remove(function(err){
													if(err){
														console.log('Error removing group: ', err);
													}
													groups.splice(index,1);
												});
											} else {
												eligibleGroups.push(group);
											}
										});
										//Now, reassign users who were just booted out of their group of < 3 players
										//Note: use eachSeries here so that the group num_players value does not get out of sync if group saves are processed out of order or delayed.
										async.eachSeries(players, function(player, nextPlayer) {
											if(player.group && !GROUP_MAP[player.group]) {
												//Choose a random group to place this player in.
												var index = _.random(0, eligibleGroups.length - 1);
												player.group = eligibleGroups[index]._id;
												eligibleGroups[index].num_players++;
												eligibleGroups[index].save(function(err){
													if(err){
														console.log('Error saving group: ', err);
													}
													nextPlayer(err);
												});
												player.save(function(err){
													if(err){
														console.log('Error saving player: ', err);
													}
												});
											} else {
												nextPlayer();
											}
											
										}, function(err) {
									        if (err) {
										        console.log("An error occurred trying to reassign users booted from a group with < 3 players");
									        }
									        
									        //We are completely finished with group assignments.
									        if(V) console.log("Group assignments are finished.");
									        if(V) console.log("Starting to process player actions and update balances");
									        
									        updateActionsAndBalances(groups, players, function(err) {
												if(err) console.log("An error occurred while trying to update actions and balances.", err);
											    //Process the next experimonth
												nextMonth();

											});
									        
									    });
										
									} else { // less than 15 total players
										
										//We are completely finished with group assignments.
								        if(V) console.log("Group assignments are finished.");
								        if(V) console.log("Starting to process player actions and update balances");
								        
								        updateActionsAndBalances(groups, players, function(err) {
											if(err) console.log("An error occurred while trying to update actions and balances.", err);
										    //Process the next experimonth
											nextMonth();

										});
										
										
									}
									
									   
							    }
							);	//end whilst()
						}); //end Player.find();
					}); //end Group.find();
			        
			        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++			        

			    });
				
			} else {
				if(V) console.log("This experimonth (" + experimonth._id + ") has no users. No processing required.");
				nextMonth();
			}
	
		}, function(err) {
	        if (err) {
		        console.log("An error occurred trying to process the experimonths.");
	        } else {
		    	console.log("All Experimonths have been processed. This job is complete.");  
	        }
	        res.redirect('/groups/list');
	    });
	
	});

	
	var updateActionsAndBalances = function(groups, players, callback) {
					
		//Note: Processing as a series since performance is not critical and it's easy to follow the progress/logging this way.
		async.eachSeries(groups, function(group, nextGroup) { 
			if(V) console.log("Now processing group: " + group._id);
	
			var eligiblePlayers = [];
			var dailyTotal = 0;
			
			async.eachLimit(players, 5, function(player, nextPlayer) {
				//Only focus on players that are a member of this group.
				if(player.group && player.group == group._id.toString()) {
					
					//If the player doesnt have an action for today, check for a default or else set to null (no action).
					if(!player.todaysAction) {
						player.todaysAction = player.defaultAction ? player.defaultAction : null;
					}
					if(player.todaysAction == "invest") {
						dailyTotal += config.pointsToInvest;
						eligiblePlayers.push(player);
					} 
					else if(player.todaysAction == "freeload") {
						eligiblePlayers.push(player);
						player.balance += config.pointsToInvest; //freeloaders bank this amount.
					}
					
					//Update the actions now that we've processed them.
					player.lastAction = player.todaysAction;
					player.todaysAction = null;
					player.save(function(err){
						if(err) console.log('Error updating player actions and balance: ', err);
						nextPlayer(err);
					});
				} else {
					nextPlayer();
				}
				
			}, function(err) {
				if (err) console.log("An error occurred while trying to update all player actions for group: " + group._id);
				if(V) console.log("All player actions have been updated for group: " + group._id);
				
				//Now that all group members have been processed and saved, double the total and compute all eligible players' shares.
				dailyTotal = dailyTotal * 2;
				var earnedAmount = dailyTotal / eligiblePlayers.length;
				
				if(!earnedAmount || earnedAmount <= 0) {
					//No need to update balance. Either no eligible players and/or 100% freeloaders
					if(V) console.log("Today's earned amount was $0. Number of eligible players: " + eligiblePlayers.length);
					nextGroup();
					
				} else {
				
					//Loop eligiblePlayers again to update their balance w/ the earned amount from investing
					if(V) console.log("Now it's time to update the balances with today's earned amount: " + earnedAmount);
					async.eachLimit(eligiblePlayers, 5, function(player, nextEligiblePlayer) {
						player.balance += earnedAmount;
						player.save(function(err){
							if(err) console.log('Error saving player balance: ', err);
							nextEligiblePlayer(err);
						});
					}, function(err) {
					    if (err) console.log("An error occurred while trying to update eligible player balances.");
					    if(V) console.log("All player balances have been updated.");
					    nextGroup(err);
					});					
				}

		    });
								
		}, function(err) {
	        if (err) console.log("An error occurred while trying to update actions and balances for all groups.");
	        if(V) console.log("All Groups have been processed. Actions reset and balances updated.");
	        callback(err);
	    });
	
	};

	
});






