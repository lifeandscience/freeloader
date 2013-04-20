# Freeloader

Freeloader is a online, public goods game (1) inspired by the free rider problem (2).  It is played once a day, everyday for a month.  Participants are grouped together at random on day one and notified that a new game has begun. That day and each day after, they are given one game dollar that they can either invest, keep or spend to leave the group they've been assigned to. At the end of everyday, all players and their votes are tallied and the dollars in each group that are invested are doubled and then distributed equally amongst all players except those who chose to leave the group.  Those that leave the group are reassigned to a new or pre-existing group (depending on the current number/makeup of groups) the next day. The goal is to finish the game with the most money.

Examples for a 10-person group...
Scenario #1: Everyone invests: Each person takes away $2
Scenario #2: 8 invest, 2 keep: Investors take away $1.60, Keepers take away $2.60
Scenario #3: 7 invest, 2 keep, 1 leaves: Investors take away $1.56, Keepers take away $2.56, Leavers take away $0
Scenario #4: 1 invests, 9 keeps: Investor takes away $0.20, Keepers take away $1.20
Scenario #5: 1 invest, 1 keeps, 8 leave: Investor takes away $1, Keeper takes away $2, Leavers take away $0

There is no optimum group size, but there is an optimum number of groups -- 1/10th the number of participants.  Initial groups are formed by creating x groups, where x = 1/10th of total number of participants. Then, the initial players are randomly assigned to those groups. x is the maximum number of groups available; 3 is the minimum number of people in a given group. At the end of a day, those players who left their group will either create a new group if the total number of groups is less than x, or will be randomly assigned to an existing group (but not the group they just left) if the total number of groups is at x. If players leave a group such that the number of players left in the group is less than 3, those 1 or 2 players will be randomly assigned to a new group and the previous group will be removed.

1 http://en.wikipedia.org/wiki/Public_goods_game
2 http://en.wikipedia.org/wiki/Free_rider_problem