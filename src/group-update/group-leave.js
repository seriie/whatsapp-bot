// src/group-update/group-leave.js
async function groupLeave(client) {
    client.ev.on('group-participants.update', async (update) => {
        if (update.action === 'remove' || update.action === 'leave') {
            const chat = await client.groupMetadata(update.id);
            const participantId = update.participants[0]; // ID dari peserta yang keluar

            try {
                // Ambil metadata grup
                const groupMetadata = await client.groupMetadata(chat.id);
                const participants = groupMetadata.participants;
                
                // Temukan nama pengguna peserta yang keluar 
                const participant = participants.find(p => p.id === participantId);
                const userName = participant ? participant.notify : participantId.split('@')[0];
                
                const message = `Bye @${userName},\n\nselamat tinggal 😊`;

                // Mengirim pesan dengan tag
                if (participantId) {
                    await client.sendMessage(chat.id, {
                        text: message,
                        mentions: [participantId]
                    });

                    console.log(`${participantId} just left the group`);
                } else {
                    console.log('Invalid participant ID:', participantId);
                }
            } catch (error) {
                console.error('Error handling group leave:', error);
            }
        }
    });
}

module.exports = { groupLeave };