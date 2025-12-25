submitMissionCard(card) {
    // Check if already submitted
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
        // Check if we already submitted (in case of race condition)
        if (cards.length >= (this.gameState.selectedTeam || []).length) {
            return; // Abort transaction
        }
        cards.push(card);
        return cards;
    }).then((result) => {
        if (result.committed) {
            console.log('Mission card submitted successfully');
        } else {
            console.log('Transaction aborted (already full)');
        }
    }).catch((error) => {
        console.error('Error submitting mission card:', error);
        // Rollback local storage if failed
        localStorage.removeItem(missionKey);
    });

    // Show waiting panel
    document.getElementById('missionPanel').classList.add('hidden');
    document.getElementById('waitingMissionPanel').classList.remove('hidden');
}
