// const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const path = require('path');

async function groupJoin(client) {
    client.ev.on('group-participants.update', async (notification) => {
        if (notification.action === 'add') {
            console.log('Group join event detected!');
            const groupId = notification.id;
            const participantId = notification.participants[0];
            
            try {
                if(groupId == '6289521889450-1588171145@g.us') {
                    const groupMetadata = await client.groupMetadata(groupId);
                    const groupSubject = groupMetadata.subject;
                    const groupName = groupSubject.trim();
    
                    // Siapkan pesan
                    const userId = participantId.split('@')[0];
                    const messageText = `Halo @${userId}🎉, selamat datang di grup\n🪀 *${groupName}* 🪀\n\nDikarenakan admin sudah tidak aktif lagi, kita membuat grup alternatif mulai sekarang\n\nBerikut link grupnya: https://chat.whatsapp.com/LoLQKfKaa0TKuGEdKvIPw9`;
    
                    // Dapatkan URL foto profil peserta
                    let profilePicUrl;
                    
                    try {
                        profilePicUrl = await sock.profilePictureUrl(participantId, 'image');
                    } catch (err) {
                        console.warn(`Tidak bisa mengambil foto profil untuk ${participantId}, menggunakan default.` + err);
                    }
    
                    let media;
                    if (profilePicUrl) {
                        // Mengunduh media dari URL profil
                        media = { url: profilePicUrl };
                    } else {
                        // Gunakan gambar default jika foto profil tidak tersedia
                        const defaultImagePath = path.join(__dirname, 'lily-photo.jpg');
                        media = { url: defaultImagePath };
                    }
    
                    // Kirim pesan dengan foto profil atau gambar default
                    await client.sendMessage(groupId, { image: media, caption: messageText, mentions: [participantId] });
    
                    console.log(`${participantId} baru saja bergabung ke grup ${groupName}`);
                } else {
                    // Dapatkan metadata grup untuk mengambil nama grup
                    const groupMetadata = await client.groupMetadata(groupId);
                    const groupSubject = groupMetadata.subject;
                    const groupName = groupSubject.trim();
    
                    // Siapkan pesan
                    const userId = participantId.split('@')[0];
                    const messageText = `Halo @${userId}🎉, selamat datang di grup\n🪀 *${groupName}* 🪀\n\nKami sangat gembira Anda bergabung dengan grup ini. Siap untuk berteman dan berinteraksi bersama? Ayo mulai obrolan dan buat momen menyenangkan bersama!\n\nsource code bot: https://github.com/seriie/whatsapp-bot\n\nsemoga betah 😊`;
    
                    // Dapatkan URL foto profil peserta
                    let profilePicUrl;
                    
                    try {
                        profilePicUrl = await client.profilePictureUrl(participantId, 'image');
                    } catch (err) {
                        console.warn(`Tidak bisa mengambil foto profil untuk ${participantId}, menggunakan default.`);
                    }
    
                    let media;
                    if (profilePicUrl) {
                        // Mengunduh media dari URL profil
                        media = { url: profilePicUrl };
                    } else {
                        // Gunakan gambar default jika foto profil tidak tersedia
                        const defaultImagePath = path.join(__dirname, 'lily-photo.jpg');
                        media = { url: defaultImagePath };
                    }
    
                    // Kirim pesan dengan foto profil atau gambar default
                    await client.sendMessage(groupId, { image: media, caption: messageText, mentions: [participantId] });
    
                    console.log(`${participantId} baru saja bergabung ke grup ${groupName}`);
                }
            } catch (error) {
                console.error('Error handling group join:', error);
            }
        }
    });
}

module.exports = { groupJoin };

