// Avalon Game Rules and Configuration

const AVALON = {
    // Role definitions
    ROLES: {
        // Good team
        MERLIN: {
            name: 'Merlin',
            team: 'good',
            icon: '🧙',
            description: 'Knows who the evil players are (except Mordred)'
        },
        PERCIVAL: {
            name: 'Percival',
            team: 'good',
            icon: '🛡️',
            description: 'Knows who Merlin is (but Morgana appears as Merlin too)'
        },
        LOYAL_SERVANT: {
            name: 'Loyal Servant',
            team: 'good',
            icon: '⚔️',
            description: 'A loyal servant of Arthur with no special abilities'
        },
        // Evil team
        ASSASSIN: {
            name: 'Assassin',
            team: 'evil',
            icon: '🗡️',
            description: 'Can assassinate Merlin at the end if Good wins'
        },
        MORGANA: {
            name: 'Morgana',
            team: 'evil',
            icon: '🧙‍♀️',
            description: 'Appears as Merlin to Percival'
        },
        MORDRED: {
            name: 'Mordred',
            team: 'evil',
            icon: '👿',
            description: 'Unknown to Merlin'
        },
        OBERON: {
            name: 'Oberon',
            team: 'evil',
            icon: '👻',
            description: 'Does not know other evil players, and they don\'t know him'
        },
        MINION: {
            name: 'Minion of Mordred',
            team: 'evil',
            icon: '💀',
            description: 'A generic evil minion'
        }
    },

    // Player count configurations
    PLAYER_CONFIG: {
        5: { good: 3, evil: 2, missions: [2, 3, 2, 3, 3] },
        6: { good: 4, evil: 2, missions: [2, 3, 4, 3, 4] },
        7: { good: 4, evil: 3, missions: [2, 3, 3, 4, 4] },
        8: { good: 5, evil: 3, missions: [3, 4, 4, 5, 5] },
        9: { good: 6, evil: 3, missions: [3, 4, 4, 5, 5] },
        10: { good: 6, evil: 4, missions: [3, 4, 4, 5, 5] }
    },

    // Mission 4 requires 2 fails for 7+ players
    DOUBLE_FAIL_MISSION: 4, // Mission index (0-based: 3)
    DOUBLE_FAIL_MIN_PLAYERS: 7,

    // Game phases
    PHASES: {
        LOBBY: 'lobby',
        ROLE_REVEAL: 'role_reveal',
        TEAM_SELECTION: 'team_selection',
        VOTING: 'voting',
        MISSION: 'mission',
        ASSASSINATION: 'assassination',
        GAME_OVER: 'game_over'
    },

    // Assign roles based on player count and selected optional roles
    assignRoles(playerCount, options = {}) {
        const config = this.PLAYER_CONFIG[playerCount];
        if (!config) {
            throw new Error('Invalid player count. Must be 5-10 players.');
        }

        const roles = [];
        let goodRemaining = config.good;
        let evilRemaining = config.evil;

        // Always include Merlin and Assassin
        roles.push('MERLIN');
        goodRemaining--;
        roles.push('ASSASSIN');
        evilRemaining--;

        // Optional good roles
        if (options.usePercival && goodRemaining > 0) {
            roles.push('PERCIVAL');
            goodRemaining--;
        }

        // Optional evil roles
        if (options.useMorgana && evilRemaining > 0) {
            roles.push('MORGANA');
            evilRemaining--;
        }
        if (options.useMordred && evilRemaining > 0) {
            roles.push('MORDRED');
            evilRemaining--;
        }
        if (options.useOberon && evilRemaining > 0) {
            roles.push('OBERON');
            evilRemaining--;
        }

        // Fill remaining with generic roles
        while (goodRemaining > 0) {
            roles.push('LOYAL_SERVANT');
            goodRemaining--;
        }
        while (evilRemaining > 0) {
            roles.push('MINION');
            evilRemaining--;
        }

        // Shuffle roles
        return this.shuffleArray(roles);
    },

    // Get role info for a player
    getRoleInfo(roleKey, allPlayers) {
        const role = this.ROLES[roleKey];
        if (!role) return null;

        const info = {
            ...role,
            key: roleKey,
            knows: []
        };

        // What each role knows
        switch (roleKey) {
            case 'MERLIN':
                // Merlin sees evil (except Mordred)
                info.knows = Object.entries(allPlayers)
                    .filter(([id, p]) => {
                        const r = p.role;
                        return this.ROLES[r]?.team === 'evil' && r !== 'MORDRED';
                    })
                    .map(([id, p]) => ({ id, name: p.name, as: 'Evil' }));
                info.knowsLabel = 'Evil players (shown as evil):';
                break;

            case 'PERCIVAL':
                // Percival sees Merlin and Morgana (but can't distinguish)
                info.knows = Object.entries(allPlayers)
                    .filter(([id, p]) => ['MERLIN', 'MORGANA'].includes(p.role))
                    .map(([id, p]) => ({ id, name: p.name, as: 'Merlin?' }));
                info.knowsLabel = 'One of these is Merlin:';
                break;

            case 'ASSASSIN':
            case 'MORGANA':
            case 'MINION':
                // Regular evil sees other evil (except Oberon)
                info.knows = Object.entries(allPlayers)
                    .filter(([id, p]) => {
                        const r = p.role;
                        return this.ROLES[r]?.team === 'evil' && r !== 'OBERON' && p.role !== roleKey;
                    })
                    .map(([id, p]) => ({ id, name: p.name, as: 'Evil Ally' }));
                info.knowsLabel = 'Your evil allies:';
                break;

            case 'MORDRED':
                // Mordred sees evil except Oberon
                info.knows = Object.entries(allPlayers)
                    .filter(([id, p]) => {
                        const r = p.role;
                        return this.ROLES[r]?.team === 'evil' && r !== 'OBERON' && r !== 'MORDRED';
                    })
                    .map(([id, p]) => ({ id, name: p.name, as: 'Evil Ally' }));
                info.knowsLabel = 'Your evil allies:';
                break;

            case 'OBERON':
                // Oberon knows nothing
                info.knows = [];
                info.knowsLabel = 'You work alone. You don\'t know your allies.';
                break;
        }

        return info;
    },

    // Check if mission fails
    checkMissionResult(cards, missionIndex, playerCount) {
        const fails = cards.filter(c => c === 'fail').length;
        
        // Mission 4 (index 3) needs 2 fails for 7+ players
        if (missionIndex === 3 && playerCount >= 7) {
            return fails >= 2 ? 'fail' : 'success';
        }
        
        return fails >= 1 ? 'fail' : 'success';
    },

    // Get team size for a mission
    getTeamSize(playerCount, missionIndex) {
        const config = this.PLAYER_CONFIG[playerCount];
        return config ? config.missions[missionIndex] : 0;
    },

    // Check win conditions
    checkWinCondition(missionResults) {
        const successes = missionResults.filter(r => r === 'success').length;
        const fails = missionResults.filter(r => r === 'fail').length;

        if (successes >= 3) return 'good_pending'; // Pending assassination
        if (fails >= 3) return 'evil';
        return null;
    },

    // Shuffle array
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
};