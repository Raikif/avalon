// Firebase Configuration untuk Avalon Game
const firebaseConfig = {
    apiKey: "AIzaSyBIp1QMrX89rncYen-VODZ8ehwN-_X5wRc",
    authDomain: "avalon-da42f.firebaseapp.com",
    databaseURL: "https://avalon-da42f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "avalon-da42f",
    storageBucket: "avalon-da42f.firebasestorage.app",
    messagingSenderId: "1098381686240",
    appId: "1:1098381686240:web:95f0fc8bb3b31df116e785"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Helper functions
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substring(2, 15);
}

function getGameRef(gameCode) {
    return database.ref('games/' + gameCode);
}
