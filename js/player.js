// Player/Mobile Logic

class AvalonPlayer {
    constructor() {
        const params = new URLSearchParams(window.location.search);
        this.gameCode = params.get('code');
        this.playerName = decodeURIComponent(params.get('name') || 'Player');
        this.playerId = this.getOrCreatePlayerId();
        this.gameRef = null;
        this.playerRef = null;
        this.gameState = null;
        this.myRole = null;
        this.hasRevealedRole = false;

        console.log('AvalonPlayer initialized');
        console.log('Game Code:', this.gameCode);
        console.log('Player Name:', this.playerName);
        console.log('Player ID:', this.playerId);

        this.init();
    }

    getOrCreatePlayerId() {
        let id = localStorage.getItem(`avalon_player_${this.gameCode}`);
        if (!id) {
            id = generatePlayerId();
            localStorage.setItem(`avalon_player_${this.gameCode}`, id);
        }
        return id;
    }

    init() {
        if (!this.gameCode || !this.playerName) {
            alert('Invalid game info!');
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('displayName').textContent = this.playerName;

        try {
            this.gameRef = getGameRef(this.gameCode);
            this.playerRef = this.gameRef.child(`players/${this.playerId}`);

            // Check if game exists
            this.gameRef.once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    alert('Game not found! Code: ' + this.gameCode);
                    window.location.href = 'index.html';
                    return;
                }
                console.log('Game found, joining...');
                this.joinGame();
            });
        } catch (error) {
            console.error('Firebase error:', error);
            alert('Error connecting: ' + error.message);
        }
    }

    joinGame() {
        // Add player to game
        this.playerRef.set({
            name: this.playerName,
            joinedAt: Date.now(),
            ready: false
        }).then(() => {
            console.log('Joined game successfully');
        }).catch((error) => {
            console.error('Error joining game:', error);
        });

        // Remove on disconnect
        this.playerRef.onDisconnect().remove();

        // Listen for game changes
        this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();
            console.log('Game state updated:', this.gameState);
            
            if (this.gameState) {
                // Check if I have a role assigned
                const myData = this.gameState.players?.[this.playerId];
                if (myData?.role) {
                    this.myRole = myData.role;
                    console.log('My role:', this.myRole);
                }
                
                this.handleGameStateChange();
            }
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Role card flip
        document.getElementById('roleCard').addEventListener('click', () => {
            if (!this.myRole) {
                console.log('No role assigned yet');
                return;
            }
            
            document.getElementById('roleCard').classList.add('flipped');
            this.hasRevealedRole = true;
            
            // Show ready button after flip
            setTimeout(() => {
                document.getElementById('readyBtn').classList.remove('hidden');
            }, 600);
        });

        // Ready button
        document.getElementById('readyBtn').addEventListener('click', () => {
            this.playerRef.update({ ready: true });
            document.getElementById('readyBtn').disabled = true;
            document.getElementById('readyBtn').textContent = 'Waiting for others...';
        });

        // Team selection confirm
        document.getElementById('confirmTeamBtn').addEventListener('click', () => {
            this.confirmTeamSelection();
        });

        // Voting
        document.getElementById('approveBtn').addEventListener('click', () => {
            this.submitVote('approve');
        });
        document.getElementById('rejectBtn').addEventListener('click', () => {
            this.submitVote('reject');
        });

        // Mission
        document.getElementById('successBtn').addEventListener('click', () => {
            this.submitMissionCard('success');
        });
        document.getElementById('failBtn').addEventListener('click', () => {
            this.submitMissionCard('fail');
        });

        // Assassination
        document.getElementById('confirmKillBtn').addEventListener('click', () => {
            this.confirmAssassination();
        });
    }

    handleGameStateChange() {
        const phase = this.gameState.phase;
        console.log('Current phase:', phase);

        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

        switch (phase) {
            case AVALON.PHASES.LOBBY:
                document.getElementById('waitingScreen').classList.remove('hidden');
                break;

            case AVALON.PHASES.ROLE_REVEAL:
                document.getElementById('roleScreen').classList.remove('hidden');
                this.showMyRole();
                break;

            case AVALON.PHASES.TEAM_SELECTION:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showTeamSelectionPhase();
                break;

            case AVALON.PHASES.VOTING:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showVotingPhase();
                break;

            case AVALON.PHASES.MISSION:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showMissionPhase();
                break;

            case AVALON.PHASES.ASSASSINATION:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showAssassinationPhase();
                break;

            case AVALON.PHASES.GAME_OVER:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showGameOver();
                break;
        }

        this.updateStatusBar();
    }

    updateStatusBar() {
        if (!this.myRole) {
            document.getElementById('statusRole').textContent = 'No role yet';
            return;
        }

        const role = AVALON.ROLES[this.myRole];
        if (!role) {
            console.error('Unknown role:', this.myRole);
            document.getElementById('statusRole').textContent = 'Unknown role';
            return;
        }

        const statusRole = document.getElementById('statusRole');
        statusRole.textContent = role.icon + ' ' + role.name;
        statusRole.className = 'status-role ' + role.team;

        const phase = this.gameState.phase;
        const phaseText = {
            [AVALON.PHASES.TEAM_SELECTION]: 'Team Selection',
            [AVALON.PHASES.VOTING]: 'Voting',
            [AVALON.PHASES.MISSION]: 'Mission',
            [AVALON.PHASES.ASSASSINATION]: 'Assassination',
            [AVALON.PHASES.GAME_OVER]: 'Game Over'
        };
        document.getElementById('statusPhase').textContent = phaseText[phase] || '';
    }

    showMyRole() {
        console.log('showMyRole called, myRole:', this.myRole);
        
        if (!this.myRole) {
            console.log('No role assigned yet');
            document.getElementById('roleName').textContent = 'Loading...';
            return;
        }

        const role = AVALON.ROLES[this.myRole];
        if (!role) {
            console.error('Unknown role key:', this.myRole);
            document.getElementById('roleName').textContent = 'Error: Unknown Role';
            return;
        }

        console.log('Displaying role:', role);

        // Set role info
        document.getElementById('roleName').textContent = role.name;
        document.getElementById('roleIcon').textContent = role.icon;
        document.getElementById('roleTeam').textContent = 
            role.team === 'good' ? '🔵 Loyal Servant of Arthur' : '🔴 Minion of Mordred';

        // Set card color based on team
        const cardBack = document.querySelector('.role-card-back');
        cardBack.classList.remove('good', 'evil');
        cardBack.classList.add(role.team);

        // Show role info (what this role knows)
        const roleInfo = AVALON.getRoleInfo(this.myRole, this.gameState.players);
        let infoHTML = `<p>${role.description}</p>`;
        
        if (roleInfo && roleInfo.knows && roleInfo.knows.length > 0) {
            infoHTML += `<p style="margin-top: 15px; font-weight: bold;">${roleInfo.knowsLabel}</p>`;
            infoHTML += '<ul style="list-style: none; padding: 0; margin-top: 10px;">';
            roleInfo.knows.forEach(p => {
                infoHTML += `<li style="padding: 5px 0;">👤 ${p.name}</li>`;
            });
            infoHTML += '</ul>';
        } else if (roleInfo && roleInfo.knowsLabel && role.team === 'evil') {
            infoHTML += `<p style="margin-top: 15px;">${roleInfo.knowsLabel}</p>`;
        }
        
        document.getElementById('roleInfo').innerHTML = infoHTML;

        // Update front card text
        document.querySelector('.role-card-front p').textContent = '👆 Tap to reveal your role';
    }

    showTeamSelectionPhase() {
        // Hide all panels
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const isKing = this.gameState.currentKing === this.playerId;
        console.log('Is King:', isKing);

        if (isKing) {
            document.getElementById('teamSelectionPanel').classList.remove('hidden');
            this.setupTeamSelection();
        } else {
            document.getElementById('waitingKingPanel').classList.remove('hidden');
            const kingName = this.gameState.players[this.gameState.currentKing]?.name || 'Unknown';
            document.getElementById('currentKingName').textContent = kingName;
        }
    }

    setupTeamSelection() {
        const playerCount = Object.keys(this.gameState.players).length;
        const mission = this.gameState.currentMission;
        const teamSize = AVALON.getTeamSize(playerCount, mission);

        document.getElementById('teamSizeRequired').textContent = teamSize;

        const container = document.getElementById('playerSelectList');
        const playerOrder = this.gameState.playerOrder || Object.keys(this.gameState.players);

        container.innerHTML = playerOrder.map(id => {
            const player = this.gameState.players[id];
            return `
                <div class="player-select-item" data-player-id="${id}">
                    ${player.name} ${id === this.playerId ? '(You)' : ''}
                </div>
            `;
        }).join('');

        // Selection logic
        let selected = [];
        const confirmBtn = document.getElementById('confirmTeamBtn');
        
        container.querySelectorAll('.player-select-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.playerId;
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    selected = selected.filter(s => s !== id);
                } else if (selected.length < teamSize) {
                    item.classList.add('selected');
                    selected.push(id);
                }
                confirmBtn.disabled = selected.length !== teamSize;
            });
        });

        // Store selection reference
        this.selectedTeam = () => selected;
    }

    confirmTeamSelection() {
        const team = this.selectedTeam?.() || [];
        if (team.length === 0) return;

        console.log('Confirming team:', team);

        this.gameRef.update({
            selectedTeam: team,
            phase: AVALON.PHASES.VOTING
        });
    }

    showVotingPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const votes = this.gameState.votes || {};
        const hasVoted = votes[this.playerId] !== undefined;

        if (hasVoted) {
            document.getElementById('waitingVotesPanel').classList.remove('hidden');
        } else {
            document.getElementById('votingPanel').classList.remove('hidden');

            // Show team
            const team = this.gameState.selectedTeam || [];
            document.getElementById('proposedTeam').innerHTML = team
                .map(id => {
                    const name = this.gameState.players[id]?.name || 'Unknown';
                    const isMe = id === this.playerId;
                    return `<span class="team-member ${isMe ? 'is-me' : ''}">${name}${isMe ? ' (You)' : ''}</span>`;
                }).join('');
        }
    }

    submitVote(vote) {
        console.log('Submitting vote:', vote);
        this.gameRef.child(`votes/${this.playerId}`).set(vote);
        document.getElementById('votingPanel').classList.add('hidden');
        document.getElementById('waitingVotesPanel').classList.remove('hidden');
    }

    showMissionPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const team = this.gameState.selectedTeam || [];
        const isOnMission = team.includes(this.playerId);

        console.log('Is on mission:', isOnMission);

        if (isOnMission) {
            // Check if already submitted
            const missionKey = `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`;
            const missionSubmitted = localStorage.getItem(missionKey);

            if (missionSubmitted) {
                document.getElementById('waitingMissionPanel').classList.remove('hidden');
            } else {
                document.getElementById('missionPanel').classList.remove('hidden');

                // Evil can fail
                const role = AVALON.ROLES[this.myRole];
                if (role?.team === 'evil') {
                    document.getElementById('failBtn').classList.remove('hidden');
                } else {
                    document.getElementById('failBtn').classList.add('hidden');
                }
            }
        } else {
            document.getElementById('waitingMissionPanel').classList.remove('hidden');
        }
    }

    submitMissionCard(card) {
        console.log('Submitting mission card:', card);

        // Mark as submitted locally
        const missionKey = `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`;
        localStorage.setItem(missionKey, 'true');

        // Add card to array
        this.gameRef.child('missionCards').transaction((cards) => {
            if (cards === null) cards = [];
            cards.push(card);
            return cards;
        });

        document.getElementById('missionPanel').classList.add('hidden');
        document.getElementById('waitingMissionPanel').classList.remove('hidden');
    }

    showAssassinationPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const isAssassin = this.myRole === 'ASSASSIN';
        console.log('Is Assassin:', isAssassin);

        if (isAssassin) {
            document.getElementById('assassinationPanel').classList.remove('hidden');
            this.setupAssassinationTargets();
        } else {
            document.getElementById('waitingAssassinPanel').classList.remove('hidden');
        }
    }

    setupAssassinationTargets() {
        const container = document.getElementById('assassinTargetList');
        
        // Show only good players as potential targets
        const goodPlayers = Object.entries(this.gameState.players)
            .filter(([id, p]) => AVALON.ROLES[p.role]?.team === 'good');

        container.innerHTML = goodPlayers.map(([id, player]) => `
            <div class="player-select-item" data-player-id="${id}">
                ${player.name}
            </div>
        `).join('');

        let selectedTarget = null;
        const confirmBtn = document.getElementById('confirmKillBtn');
        
        container.querySelectorAll('.player-select-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.player-select-item').forEach(i => 
                    i.classList.remove('selected'));
                item.classList.add('selected');
                selectedTarget = item.dataset.playerId;
                confirmBtn.disabled = false;
            });
        });

        confirmBtn.disabled = true;
        this.assassinTarget = () => selectedTarget;
    }

    confirmAssassination() {
        const target = this.assassinTarget?.();
        if (!target) return;

        console.log('Assassinating:', target);

        const targetRole = this.gameState.players[target]?.role;
        const isMerlin = targetRole === 'MERLIN';

        this.gameRef.update({
            phase: AVALON.PHASES.GAME_OVER,
            winner: isMerlin ? 'evil' : 'good',
            winReason: isMerlin 
                ? 'The Assassin found and killed Merlin!' 
                : 'The Assassin failed to find Merlin! Good wins!',
            assassinatedPlayer: target
        });
    }

    showGameOver() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('gameOverPanel').classList.remove('hidden');

        const winner = this.gameState.winner;
        const myTeam = AVALON.ROLES[this.myRole]?.team;
        const didWin = winner === myTeam;

        document.getElementById('resultText').textContent = 
            didWin ? '🎉 You Won!' : '😢 You Lost!';
        document.getElementById('resultText').style.color = 
            didWin ? 'var(--color-success)' : 'var(--color-fail)';

        const role = AVALON.ROLES[this.myRole];
        document.getElementById('yourRoleReveal').innerHTML = `
            <p>You were <strong>${role?.icon} ${role?.name}</strong></p>
            <p style="margin-top: 10px;">${this.gameState.winReason || ''}</p>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AvalonPlayer...');
    new AvalonPlayer();
});
