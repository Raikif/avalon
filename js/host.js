// Host/TV Display Logic

class AvalonHost {
    constructor() {
        this.gameCode = new URLSearchParams(window.location.search).get('code');
        this.gameRef = null;
        this.players = {};
        this.gameState = null;
        
        // Flags untuk mencegah double processing
        this.isRevealingMission = false;
        this.isRevealingVotes = false;
        this.lastProcessedMission = -1;

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

        this.updateGameCodeDisplay();
        this.generateQRCode();

        try {
            this.gameRef = getGameRef(this.gameCode);
            console.log('Firebase ref created');
            this.setupGame();
            this.setupListeners();
        } catch (error) {
            console.error('Firebase error:', error);
            alert('Error connecting to Firebase: ' + error.message);
        }
    }

    getBaseUrl() {
        const url = window.location.href;
        const baseUrl = 
