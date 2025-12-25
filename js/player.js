// Player/Mobile Logic

class AvalonPlayer {
    constructor() {
        const params = new URLSearchParams(window.location.search);
        this.gameCode = params.get('code');
        this.playerName = null;
        this.playerId = null;
        this.gameRef = null;
        this.playerRef = null;
        this.gameState = null;
        this.myRole = null;
        this.hasJoined = false;

        console.log('AvalonPlayer initialized');
        console.log('Game Code:', this.gameCode);

        this.init();
    }

    init() {
        if (!this.gameCode) {
            alert('No game code provided! Please scan QR code again.');
            window.location.href = 'index.html';
            return;
        }

        // Show game code
        document.getElementById('displayGameCode').textContent = this.gameCode;

        // Check if game exists
        try {
            this.gameRef = getGameRef(this.gameCode);
            
            this.gameRef.once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    alert('Game not found! Code: ' + this.gameCode);
                    window.location.href = 'index.html';
                    return;
                }
                
                console.log('Game found!');
                
                // Check if already joined before (refresh page case)
                this.checkExistingSession();
            });
        } catch (error) {
            console.error('Firebase error:', error);
            alert('Error connecting: ' + error.message);
        }

        this.setupJoinForm();
    }

    checkExistingSession() {
        // Check if player already joined this game
        const savedPlayerId = localStorage.getItem(`avalon_player_id_${this.gameCode}`);
        const savedPlayerName = localStorage.getItem(`avalon_player_name_${this.gameCode}`);

        if (savedPlayerId && savedPlayerName) {
            // Check if still in game
            this.gameRef.child(`players/${savedPlayerId}`).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    console.log('Rejoining as:', savedPlayerName);
                    this.playerId = savedPlayerId;
                    this.playerName = savedPlayerName;
                    this.hasJoined = true;
                    this.startListening();
                } else {
                    // Player was removed, clear session
                    localStorage.removeItem(`avalon_player_id_${this.gameCode}`);
                    localStorage.removeItem(`avalon_player_name_${this.gameCode}`);
                    this.showJoinScreen();
                }
            });
        } else {
            this.showJoinScreen();
        }
    }

    showJoinScreen() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('joinScreen').classList.remove('hidden');
    }

    setupJoinForm() {
        const nameInput = document.getElementById('nameInput');
        const joinBtn = document.getElementById('joinGameBtn');

        // Enable/disable button based on input
        nameInput.addEventListener('input', () => {
            const name = nameInput.value.trim();
            joinBtn.disabled = name.length < 1;
        });

        // Handle Enter key
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !joinBtn.disabled) {
                this.joinGame();
            }
        });

        // Handle join button click
        joinBtn.addEventListener('click', () => {
            this.joinGame();
        });
    }

    joinGame() {
        const nameInput = document.getElementById('nameInput');
        const name = nameInput.value.trim();

        if (name.length < 1) {
            alert('Please enter your name!');
            return;
        }

        if (name.length > 15) {
            alert('Name too long! Max 15 characters.');
            return;
        }

        this.playerName = name;
        this.playerId = generatePlayerId();

        // Save to localStorage
        localStorage.setItem(`avalon_player_id_${this.gameCode}`, this.playerId);
        localStorage.setItem(`avalon_player_name_${this.gameCode}`, this.playerName);

        // Update UI immediately
        document.getElementById('displayName').textContent = this.playerName;

        // Add player to Firebase
        this.playerRef = this.gameRef.child(`players/${this.playerId}`);
        
        this.playerRef.set({
            name: this.playerName,
            joinedAt: Date.now(),
            ready: false
        }).then(() => {
            console.log('Joined game successfully as:', this.playerName);
            this.hasJoined = true;
            this.startListening();
        }).catch((error) => {
            console.error('Error joining game:', error);
            alert('Error joining game: ' + error.message);
        });

        // Remove on disconnect
        this.playerRef.onDisconnect().remove();
    }

    startListening() {
        // Show waiting screen
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('waitingScreen').classList.remove('hidden');
        document.getElementById('displayName').textContent = this.playerName;

        // Setup player ref if not set
        if (!this.playerRef) {
            this.playerRef = this.gameRef.child(`players/${this.playerId}`);
        }

        // Listen for game changes
        this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();
            console.log('Game state updated');
            
            if (this.gameState) {
                // Update player count
                const playerCount = Object.keys(this.gameState.players || {}).length;
                const playerCountInfo = document.getElementById('playerCountInfo');
                if (playerCountInfo) {
                    playerCountInfo.textContent = playerCount;
                }

                // Check if I have a role assigned
                const myData = this.gameState.players?.[this.playerId];
                if (myData?.role) {
                    this.myRole = myData.role;
                    console.log('My role:', this.myRole);
                }
                
                this.handleGameStateChange();
            }
        });

        this.setupGameEventListeners();
    }

    setupGameEventListeners() {
        // Role card flip
        document.getElementById('roleCard').addEventListener('click', () => {
            if (!this.myRole) {
                console.log('No role assigned yet');
                return;
            }
            
            document.getElementById('roleCard').classList.add('flipped');
            
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

        // If not joined yet and game already started, show error
        if (!this.hasJoined && phase !== AVALON.PHASES.LOBBY) {
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            document.getElementById('joinScreen').classList.remove('hidden');
            document.querySelector('.join-content').innerHTML = `
                <h2>⚔️ AVALON</h2>
                <p style="color: #e74c3c; margin: 20px 0;">Game already started!</p>
                <p>Please wait for the next game.</p>
                <button class="btn btn-secondary" onclick="window.location.href='index.html'">Back to Home</button>
            `;
            return;
        }

        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

        switch (phase) {
            case AVALON.PHASES.LOBBY:
                if (this.hasJoined) {
                    document.getElementById('waitingScreen').classList.remove('hidden');
                } else {
                    document.getElementById('joinScreen').classList.remove('hidden');
                }
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
            document.getElementById('statusRole').textContent = 'Waiting...';
            return;
        }

        const role = AVALON.ROLES[this.myRole];
        if (!role) {
            console.error('Unknown role:', this.myRole);
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
        if (!this.myRole) {
            document.getElementById('roleName').textContent = 'Loading...';
            return;
        }

        const role = AVALON.ROLES[this.myRole];
        if (!role) {
            console.error('Unknown role key:', this.myRole);
            return;
        }

        console.log('Displaying role:', role);

        document.getElementById('roleName').textContent = role.name;
        document.getElementById('roleIcon').textContent = role.icon;
        document.getElementById('roleTeam').textContent = 
            role.team === 'good' ? '🔵 Loyal Servant of Arthur' : '🔴 Minion of Mordred';

        const cardBack = document.querySelector('.role-card-back');
        cardBack.classList.remove('good', 'evil');
        cardBack.classList.add(role.team);

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
    }

    showTeamSelectionPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const isKing = this.gameState.currentKing === this.playerId;

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
        
        // Disable buttons immediately
        document.getElementById('approveBtn').disabled = true;
        document.getElementById('rejectBtn').disabled = true;
        
        this.gameRef.child(`votes/${this.playerId}`).set(vote);
        document.getElementById('votingPanel').classList.add('hidden');
        document.getElementById('waitingVotesPanel').classList.remove('hidden');
    }

    showMissionPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const team = this.gameState.selectedTeam || [];
        const isOnMission = team.includes(this.playerId);

        if (isOnMission) {
            const missionKey = `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`;
            const missionSubmitted = localStorage.getItem(missionKey);

            if (missionSubmitted) {
                document.getElementById('waitingMissionPanel').classList.remove('hidden');
            } else {
                document.getElementById('missionPanel').classList.remove('hidden');

                const role = AVALON.ROLES[this.myRole];
                const failBtn = document.getElementById('failBtn');
                const successBtn = document.getElementById('successBtn');
                
                // Reset buttons
                successBtn.disabled = false;
                failBtn.disabled = false;
                
                if (role?.team === 'evil') {
                    failBtn.classList.remove('hidden');
                } else {
                    failBtn.classList.add('hidden');
                }
            }
        } else {
            document.getElementById('waitingMissionPanel').classList.remove('hidden');
        }
    }

    submitMissionCard(card) {
        const missionKey = `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`;
        
        if (localStorage.getItem(missionKey)) {
            console.log('Already submitted mission card');
            return;
        }

        console.log('Submitting mission card:', card);

        // Mark as submitted locally FIRST
        localStorage.setItem(missionKey, 'true');

        // Disable buttons immediately
        document.getElementById('successBtn').disabled = true;
        document.getElementById('failBtn').disabled = true;

        // Add card to array using transaction
        this.gameRef.child('missionCards').transaction((cards) => {
            if (cards === null) cards = [];
            cards.push(card);
            return cards;
        }).then((result) => {
            if (result.committed) {
                console.log('Mission card submitted successfully');
            }
        }).catch((error) => {
            console.error('Error submitting mission card:', error);
            localStorage.removeItem(missionKey);
        });

        document.getElementById('missionPanel').classList.add('hidden');
        document.getElementById('waitingMissionPanel').classList.remove('hidden');
    }

    showAssassinationPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const isAssassin = this.myRole === 'ASSASSIN';

        if (isAssassin) {
            document.getElementById('assassinationPanel').classList.remove('hidden');
            this.setupAssassinationTargets();
        } else {
            document.getElementById('waitingAssassinPanel').classList.remove('hidden');
        }
    }

    setupAssassinationTargets() {
        const container = document.getElementById('assassinTargetList');
        
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
            <button class="btn btn-secondary" style="margin-top: 20px;" onclick="location.reload()">Play Again</button>
        `;
        
        // Clear session for new game
        localStorage.removeItem(`avalon_player_id_${this.gameCode}`);
        localStorage.removeItem(`avalon_player_name_${this.gameCode}`);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AvalonPlayer...');
    new AvalonPlayer();
});
