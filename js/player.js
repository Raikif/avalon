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

        this.gameRef = getGameRef(this.gameCode);
        this.playerRef = this.gameRef.child(`players/${this.playerId}`);

        // Check if game exists
        this.gameRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                alert('Game not found!');
                window.location.href = 'index.html';
                return;
            }
            this.joinGame();
        });
    }

    joinGame() {
        // Add player to game
        this.playerRef.set({
            name: this.playerName,
            joinedAt: Date.now(),
            ready: false
        });

        // Remove on disconnect
        this.playerRef.onDisconnect().remove();

        // Listen for game changes
        this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();
            if (this.gameState) {
                this.handleGameStateChange();
            }
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Role card flip
        document.getElementById('roleCard').addEventListener('click', () => {
            document.getElementById('roleCard').classList.add('flipped');
            document.getElementById('readyBtn').classList.remove('hidden');
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
        const myData = this.gameState.players?.[this.playerId];

        if (myData?.role && !this.myRole) {
            this.myRole = myData.role;
        }

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
        if (!this.myRole) return;

        const role = AVALON.ROLES[this.myRole];
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
        if (!this.myRole) return;

        const roleInfo = AVALON.getRoleInfo(this.myRole, this.gameState.players);
        const role = AVALON.ROLES[this.myRole];

        document.getElementById('roleName').textContent = role.name;
        document.getElementById('roleIcon').textContent = role.icon;
        document.getElementById('roleTeam').textContent = 
            role.team === 'good' ? 'Loyal Servant of Arthur' : 'Minion of Mordred';

        const cardBack = document.querySelector('.role-card-back');
        cardBack.className = 'role-card-back ' + role.team;

        // Show role info
        let infoHTML = `<p>${role.description}</p>`;
        if (roleInfo.knows && roleInfo.knows.length > 0) {
            infoHTML += `<p style="margin-top: 15px;"><strong>${roleInfo.knowsLabel}</strong></p>`;
            infoHTML += roleInfo.knows.map(p => `<p>• ${p.name}</p>`).join('');
        } else if (roleInfo.knowsLabel && role.team !== 'good') {
            infoHTML += `<p style="margin-top: 15px;">${roleInfo.knowsLabel}</p>`;
        }
        document.getElementById('roleInfo').innerHTML = infoHTML;
    }

    showTeamSelectionPhase() {
        // Hide all panels
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const isKing = this.gameState.currentKing === this.playerId;

        if (isKing) {
            document.getElementById('teamSelectionPanel').classList.remove('hidden');
            this.setupTeamSelection();
        } else {
            document.getElementById('waitingKingPanel').classList.remove('hidden');
            const kingName = this.gameState.players[this.gameState.currentKing]?.name;
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
                document.getElementById('confirmTeamBtn').disabled = selected.length !== teamSize;
            });
        });

        // Store selection reference
        this.selectedTeam = () => selected;
    }

    confirmTeamSelection() {
        const team = this.selectedTeam?.() || [];
        if (team.length === 0) return;

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
                    const name = this.gameState.players[id]?.name;
                    return `<span class="team-member">${name}</span>`;
                }).join('');
        }
    }

    submitVote(vote) {
        this.gameRef.child(`votes/${this.playerId}`).set(vote);
        document.getElementById('votingPanel').classList.add('hidden');
        document.getElementById('waitingVotesPanel').classList.remove('hidden');
    }

    showMissionPhase() {
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        const team = this.gameState.selectedTeam || [];
        const isOnMission = team.includes(this.playerId);
        const cards = this.gameState.missionCards || [];
        const hasSubmitted = cards.length > team.indexOf(this.playerId);

        if (isOnMission) {
            // Check if already submitted (simple check)
            const missionSubmitted = localStorage.getItem(
                `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`
            );

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
        // Mark as submitted locally
        localStorage.setItem(
            `mission_${this.gameCode}_${this.gameState.currentMission}_${this.playerId}`,
            'true'
        );

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
        container.querySelectorAll('.player-select-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.player-select-item').forEach(i => 
                    i.classList.remove('selected'));
                item.classList.add('selected');
                selectedTarget = item.dataset.playerId;
            });
        });

        this.assassinTarget = () => selectedTarget;
    }

    confirmAssassination() {
        const target = this.assassinTarget?.();
        if (!target) return;

        const targetRole = this.gameState.players[target]?.role;
        const isMerlin = targetRole === 'MERLIN';

        this.gameRef.update({
            phase: AVALON.PHASES.GAME_OVER,
            winner: isMerlin ? 'evil' : 'good',
            winReason: isMerlin 
                ? 'The Assassin found and killed Merlin!' 
                : 'The Assassin failed to find Merlin!',
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
        document.getElementById('yourRoleReveal').textContent = 
            `You were ${role.name} (${role.team === 'good' ? 'Good' : 'Evil'})`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new AvalonPlayer();
});