// Host/TV Display Logic

class AvalonHost {
    constructor() {
        this.gameCode = new URLSearchParams(window.location.search).get('code');
        this.gameRef = null;
        this.players = {};
        this.gameState = null;

        console.log('AvalonHost initialized');
        console.log('Game Code from URL:', this.gameCode);

        this.init();
    }

    init() {
        if (!this.gameCode) {
            alert('No game code provided!');
            window.location.href = 'index.html';
            return;
        }

        // Tampilkan game code langsung
        this.updateGameCodeDisplay();
        this.generateQRCode();

        // Setup Firebase
        try {
            this.gameRef = getGameRef(this.gameCode);
            console.log('Firebase ref created:', this.gameRef);
            this.setupGame();
            this.setupListeners();
        } catch (error) {
            console.error('Firebase error:', error);
            alert('Error connecting to Firebase: ' + error.message);
        }
    }

    getBaseUrl() {
        // Untuk GitHub Pages, kita perlu include path lengkap
        const url = window.location.href;
        // Hapus 'host.html' dan query string
        const baseUrl = url.split('host.html')[0];
        return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    }

    generateQRCode() {
        const baseUrl = this.getBaseUrl();
        const joinUrl = `${baseUrl}/player.html?code=${this.gameCode}`;
        
        console.log('Base URL:', baseUrl);
        console.log('Join URL:', joinUrl);

        // Tampilkan URL
        document.getElementById('joinUrl').textContent = joinUrl;
        document.getElementById('gameCodeBig').textContent = `Code: ${this.gameCode}`;

        // Gunakan QR Code API (tidak perlu library eksternal)
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
        
        const qrContainer = document.getElementById('qrCode');
        qrContainer.innerHTML = `<img src="${qrApiUrl}" alt="QR Code" style="border-radius: 8px;">`;
        
        console.log('QR Code generated');
    }

    updateGameCodeDisplay() {
        document.getElementById('gameCodeDisplay').textContent = this.gameCode;
        console.log('Game code displayed:', this.gameCode);
    }

    setupGame() {
        // Initialize game in Firebase
        const gameData = {
            code: this.gameCode,
            phase: AVALON.PHASES.LOBBY,
            players: {},
            settings: {
                usePercival: false,
                useMorgana: false,
                useMordred: false,
                useOberon: false
            },
            currentMission: 0,
            missionResults: [],
            voteTrack: 0,
            currentKing: null,
            selectedTeam: [],
            votes: {},
            missionCards: [],
            createdAt: Date.now()
        };

        this.gameRef.set(gameData)
            .then(() => {
                console.log('Game created in Firebase successfully');
            })
            .catch((error) => {
                console.error('Error creating game:', error);
                alert('Error creating game: ' + error.message);
            });

        // Clean up on disconnect
        this.gameRef.onDisconnect().remove();
    }

    setupListeners() {
        // Listen for player changes
        this.gameRef.child('players').on('value', (snapshot) => {
            this.players = snapshot.val() || {};
            console.log('Players updated:', this.players);
            this.updatePlayersDisplay();
            this.updateStartButton();
        });

        // Listen for game state changes
        this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();
            console.log('Game state updated:', this.gameState);
            if (this.gameState) {
                this.handleGameStateChange();
            }
        });

        // Role settings
        document.getElementById('usePercival').addEventListener('change', (e) => {
            this.gameRef.child('settings/usePercival').set(e.target.checked);
        });
        document.getElementById('useMorgana').addEventListener('change', (e) => {
            this.gameRef.child('settings/useMorgana').set(e.target.checked);
        });
        document.getElementById('useMordred').addEventListener('change', (e) => {
            this.gameRef.child('settings/useMordred').set(e.target.checked);
        });
        document.getElementById('useOberon').addEventListener('change', (e) => {
            this.gameRef.child('settings/useOberon').set(e.target.checked);
        });

        // Start game button
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // New game button
        document.getElementById('newGameBtn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    updatePlayersDisplay() {
        const container = document.getElementById('playersList');
        const playerCount = Object.keys(this.players).length;
        document.getElementById('playerCount').textContent = playerCount;

        container.innerHTML = Object.entries(this.players)
            .map(([id, player]) => `
                <div class="player-card">
                    <div class="avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="name">${player.name}</div>
                </div>
            `).join('');
    }

    updateStartButton() {
        const playerCount = Object.keys(this.players).length;
        const startBtn = document.getElementById('startGameBtn');
        startBtn.disabled = playerCount < 5 || playerCount > 10;
        startBtn.textContent = playerCount < 5 
            ? `Need ${5 - playerCount} more players`
            : playerCount > 10 
                ? 'Too many players (max 10)'
                : 'Start Game';
    }

    startGame() {
        const playerIds = Object.keys(this.players);
        const playerCount = playerIds.length;

        if (playerCount < 5 || playerCount > 10) return;

        // Assign roles
        const roles = AVALON.assignRoles(playerCount, this.gameState.settings);
        
        // Shuffle player order and assign roles
        const shuffledIds = AVALON.shuffleArray(playerIds);
        const updates = {};
        
        shuffledIds.forEach((id, index) => {
            updates[`players/${id}/role`] = roles[index];
            updates[`players/${id}/order`] = index;
        });

        // Set first king
        updates['currentKing'] = shuffledIds[0];
        updates['kingIndex'] = 0;
        updates['phase'] = AVALON.PHASES.ROLE_REVEAL;
        updates['playerOrder'] = shuffledIds;

        this.gameRef.update(updates);
    }

    handleGameStateChange() {
        const phase = this.gameState.phase;

        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

        switch (phase) {
            case AVALON.PHASES.LOBBY:
                document.getElementById('lobbyScreen').classList.remove('hidden');
                break;

            case AVALON.PHASES.ROLE_REVEAL:
                document.getElementById('gameScreen').classList.remove('hidden');
                this.showRoleRevealPhase();
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
                document.getElementById('assassinationScreen').classList.remove('hidden');
                break;

            case AVALON.PHASES.GAME_OVER:
                document.getElementById('gameOverScreen').classList.remove('hidden');
                this.showGameOver();
                break;
        }

        this.updateMissionTrack();
        this.updateVoteTrack();
        this.updatePlayersCircle();
    }

    showRoleRevealPhase() {
        document.getElementById('phaseTitle').textContent = 'Role Reveal';
        document.getElementById('phaseDescription').textContent = 
            'All players, look at your phones to see your role!';

        // Check if all players are ready
        this.checkAllPlayersReady();
    }

    checkAllPlayersReady() {
        const players = this.gameState.players;
        const allReady = Object.values(players).every(p => p.ready);

        if (allReady && this.gameState.phase === AVALON.PHASES.ROLE_REVEAL) {
            // Move to team selection
            setTimeout(() => {
                this.gameRef.update({ phase: AVALON.PHASES.TEAM_SELECTION });
            }, 2000);
        }
    }

    showTeamSelectionPhase() {
        const kingName = this.gameState.players[this.gameState.currentKing]?.name || 'King';
        const mission = this.gameState.currentMission;
        const teamSize = AVALON.getTeamSize(
            Object.keys(this.gameState.players).length,
            mission
        );

        document.getElementById('phaseTitle').textContent = 'Team Selection';
        document.getElementById('phaseDescription').textContent = 
            `👑 ${kingName} is selecting ${teamSize} players for Mission ${mission + 1}`;

        document.getElementById('teamDisplay').classList.add('hidden');
        document.getElementById('voteResults').classList.add('hidden');
        document.getElementById('missionResults').classList.add('hidden');
    }

    showVotingPhase() {
        const team = this.gameState.selectedTeam || [];
        const teamNames = team.map(id => this.gameState.players[id]?.name).join(', ');

        document.getElementById('phaseTitle').textContent = 'Vote!';
        document.getElementById('phaseDescription').textContent = 
            `Vote whether to approve this team: ${teamNames}`;

        // Show selected team
        document.getElementById('teamDisplay').classList.remove('hidden');
        document.getElementById('selectedTeam').innerHTML = team
            .map(id => `<span class="team-member">${this.gameState.players[id]?.name}</span>`)
            .join('');

        document.getElementById('voteResults').classList.add('hidden');

        // Check if all votes are in
        this.checkAllVotes();
    }

    checkAllVotes() {
        const votes = this.gameState.votes || {};
        const playerCount = Object.keys(this.gameState.players).length;
        const voteCount = Object.keys(votes).length;

        if (voteCount === playerCount && this.gameState.phase === AVALON.PHASES.VOTING) {
            this.revealVotes();
        }
    }

    revealVotes() {
        const votes = this.gameState.votes || {};
        const approves = [];
        const rejects = [];

        Object.entries(votes).forEach(([playerId, vote]) => {
            const playerName = this.gameState.players[playerId]?.name;
            if (vote === 'approve') {
                approves.push(playerName);
            } else {
                rejects.push(playerName);
            }
        });

        // Show results
        document.getElementById('voteResults').classList.remove('hidden');
        document.getElementById('approveVotes').innerHTML = 
            approves.map(n => `<div>${n}</div>`).join('') || '<div>-</div>';
        document.getElementById('rejectVotes').innerHTML = 
            rejects.map(n => `<div>${n}</div>`).join('') || '<div>-</div>';

        // Determine outcome
        setTimeout(() => {
            if (approves.length > rejects.length) {
                // Team approved - go to mission
                this.gameRef.update({
                    phase: AVALON.PHASES.MISSION,
                    votes: {},
                    voteTrack: 0
                });
            } else {
                // Team rejected
                const newVoteTrack = (this.gameState.voteTrack || 0) + 1;
                
                if (newVoteTrack >= 5) {
                    // 5 rejections = Evil wins
                    this.gameRef.update({
                        phase: AVALON.PHASES.GAME_OVER,
                        winner: 'evil',
                        winReason: 'Five team proposals were rejected in a row!'
                    });
                } else {
                    // Next king
                    this.nextKing(newVoteTrack);
                }
            }
        }, 3000);
    }

    nextKing(voteTrack = 0) {
        const playerOrder = this.gameState.playerOrder;
        const currentIndex = this.gameState.kingIndex || 0;
        const nextIndex = (currentIndex + 1) % playerOrder.length;

        this.gameRef.update({
            currentKing: playerOrder[nextIndex],
            kingIndex: nextIndex,
            selectedTeam: [],
            votes: {},
            voteTrack: voteTrack,
            phase: AVALON.PHASES.TEAM_SELECTION
        });
    }

    showMissionPhase() {
        const team = this.gameState.selectedTeam || [];
        const teamNames = team.map(id => this.gameState.players[id]?.name).join(', ');

        document.getElementById('phaseTitle').textContent = 'Mission in Progress';
        document.getElementById('phaseDescription').textContent = 
            `${teamNames} are on the mission...`;

        document.getElementById('voteResults').classList.add('hidden');
        document.getElementById('missionResults').classList.add('hidden');

        // Check if all mission cards are in
        this.checkMissionCards();
    }

    checkMissionCards() {
        const cards = this.gameState.missionCards || [];
        const team = this.gameState.selectedTeam || [];

        if (cards.length === team.length && this.gameState.phase === AVALON.PHASES.MISSION) {
            this.revealMissionResult();
        }
    }

    revealMissionResult() {
        const cards = this.gameState.missionCards || [];
        const playerCount = Object.keys(this.gameState.players).length;
        const missionIndex = this.gameState.currentMission;

        // Shuffle cards for reveal
        const shuffledCards = AVALON.shuffleArray([...cards]);

        // Show cards
        document.getElementById('missionResults').classList.remove('hidden');
        const cardsContainer = document.getElementById('missionCards');
        cardsContainer.innerHTML = '';

        // Reveal cards one by one
        shuffledCards.forEach((card, i) => {
            setTimeout(() => {
                const cardEl = document.createElement('div');
                cardEl.className = `mission-card ${card === 'success' ? 'success-card' : 'fail-card'}`;
                cardEl.textContent = card === 'success' ? '✓' : '✗';
                cardsContainer.appendChild(cardEl);
            }, i * 500);
        });

        // Determine result
        setTimeout(() => {
            const result = AVALON.checkMissionResult(cards, missionIndex, playerCount);
            const newResults = [...(this.gameState.missionResults || []), result];

            // Check win condition
            const winCondition = AVALON.checkWinCondition(newResults);

            if (winCondition === 'good_pending') {
                // Good wins but assassination phase
                this.gameRef.update({
                    missionResults: newResults,
                    phase: AVALON.PHASES.ASSASSINATION,
                    missionCards: []
                });
            } else if (winCondition === 'evil') {
                // Evil wins
                this.gameRef.update({
                    missionResults: newResults,
                    phase: AVALON.PHASES.GAME_OVER,
                    winner: 'evil',
                    winReason: 'Evil won 3 missions!',
                    missionCards: []
                });
            } else {
                // Continue to next mission
                this.gameRef.update({
                    missionResults: newResults,
                    currentMission: missionIndex + 1,
                    missionCards: [],
                    selectedTeam: []
                });
                this.nextKing(0);
            }
        }, shuffledCards.length * 500 + 2000);
    }

    showGameOver() {
        const winner = this.gameState.winner;
        const winReason = this.gameState.winReason || '';

        document.getElementById('winnerText').textContent = 
            winner === 'good' ? '🏆 Good Wins!' : '💀 Evil Wins!';
        document.getElementById('winnerText').style.color = 
            winner === 'good' ? 'var(--color-good)' : 'var(--color-evil)';

        // Show all roles
        const roleReveal = document.getElementById('roleReveal');
        roleReveal.innerHTML = Object.entries(this.gameState.players)
            .map(([id, player]) => {
                const role = AVALON.ROLES[player.role];
                return `
                    <div class="reveal-card ${role.team}">
                        <div class="reveal-icon">${role.icon}</div>
                        <div class="reveal-name">${player.name}</div>
                        <div class="reveal-role">${role.name}</div>
                    </div>
                `;
            }).join('');

        if (winReason) {
            const reasonEl = document.createElement('p');
            reasonEl.textContent = winReason;
            reasonEl.style.marginTop = '20px';
            roleReveal.appendChild(reasonEl);
        }
    }

    updateMissionTrack() {
        const container = document.getElementById('missionTokens');
        if (!container) return;
        
        const playerCount = Object.keys(this.gameState?.players || {}).length;
        const config = AVALON.PLAYER_CONFIG[playerCount];
        const results = this.gameState?.missionResults || [];
        const currentMission = this.gameState?.currentMission || 0;

        if (!config) return;

        container.innerHTML = config.missions.map((size, i) => {
            let className = 'mission-token';
            if (results[i] === 'success') className += ' success';
            else if (results[i] === 'fail') className += ' fail';
            if (i === currentMission && !results[i]) className += ' current';

            const needsDoubleFail = i === 3 && playerCount >= 7;

            return `
                <div class="${className}">
                    <span class="mission-number">${i + 1}</span>
                    <span class="team-size">${size}</span>
                    ${needsDoubleFail ? '<span class="fails-needed">2 fails</span>' : ''}
                </div>
            `;
        }).join('');
    }

    updateVoteTrack() {
        const voteTrack = this.gameState?.voteTrack || 0;
        document.querySelectorAll('.vote-token').forEach((token, i) => {
            token.classList.toggle('active', i < voteTrack);
        });
    }

    updatePlayersCircle() {
        const container = document.getElementById('playersCircle');
        if (!container) return;
        
        const players = this.gameState?.players || {};
        const currentKing = this.gameState?.currentKing;
        const selectedTeam = this.gameState?.selectedTeam || [];
        const playerOrder = this.gameState?.playerOrder || Object.keys(players);

        container.innerHTML = playerOrder.map(id => {
            const player = players[id];
            if (!player) return '';

            let className = 'circle-player';
            if (id === currentKing) className += ' king';
            if (selectedTeam.includes(id)) className += ' selected';

            return `
                <div class="${className}">
                    ${id === currentKing ? '<span class="crown">👑</span>' : ''}
                    <span class="player-name">${player.name}</span>
                </div>
            `;
        }).join('');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AvalonHost...');
    new AvalonHost();
});
