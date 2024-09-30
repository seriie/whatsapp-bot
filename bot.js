const { WAConnection, DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios'); // Jika menggunakan axios untuk search
// const TikTokScraper = require('tiktok-scraper'); // Jika menggunakan TikTokScraper
const fs = require('fs');
const path = require('path');

const { handleDeepImageCommand } = require('./src/deep-img/deep-image');
const { groupLeave } = require('./src/group-update/group-leave');
const { groupJoin } = require('./src/group-update/group-join');
const config = require('./config');

// Path ke file JSON yang menyimpan data warn
const warnFilePath = path.join(__dirname, '/database/counted-warn.json');

// Load warn data from JSON
const warnData = JSON.parse(fs.readFileSync(path.join(__dirname, 'database', 'counted-warn.json'), 'utf8'));

// Function to get warn from specific usr
function getWarnCount(mentionedUserId) {
    return warnData[mentionedUserId]?.count || 0;
}


// Fungsi untuk membaca data dari file JSON
function readWarnData() {
    try {
        const data = fs.readFileSync(warnFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading warn data file:', error);
        return {}; // Mengembalikan objek kosong jika terjadi kesalahan atau file tidak ditemukan
    }
}

// Fungsi untuk menyimpan data ke file JSON
function saveWarnData(data) {
    fs.writeFileSync(warnFilePath, JSON.stringify(data, null, 2));
}

// Fungsi untuk menambahkan warn
async function addWarn(participantId, fromGroup, sock, chat) {
    const warnData = readWarnData();

    // Jika participantId belum ada di warnData, inisialisasi objek baru
    if (!warnData[participantId]) {
        warnData[participantId] = {
            count: 0,
            fromGroup: fromGroup
        };
    }

    // Tambahkan peringatan
    warnData[participantId].count += 1;

    // Tulis kembali data ke file
    writeWarnData(warnData);

    // Cek apakah warn count sudah mencapai 3
    if (warnData[participantId].count > 2) {
        try {
            await sock.groupParticipantsUpdate(chat, [participantId], 'remove');
            await sock.sendMessage(chat, { text: `@${participantId.split('@')[0]} *Has been removed*\n\n*Reason:* got warned 3x`, mentions: [participantId] });
            warnData[participantId.count == 0]
        } catch (error) {
            console.error('Error removing participant:', error);
            await sock.sendMessage(chat, { text: 'Terjadi kesalahan saat mencoba mengeluarkan peserta.' });
        }
    } else {
        await sock.sendMessage(chat, { text: `@${participantId.split('@')[0]} *Got warned:* ${warnData[participantId].count}/3`, mentions: [participantId] });
    }
}

// Case untuk perintah warn
async function handleWarn(sock, m, chat, senderIsAdmin) {
    if (senderIsAdmin) {
        const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length > 0) {
            const participantId = mentions[0];
            await addWarn(sock, chat, participantId);
        } else {
            const wrongFormatCmd = '```Format perintah salah. Gunakan``` `!warn @tag_peserta`'
            await sock.sendMessage(chat, { text: wrongFormatCmd });
        }
    } else {
        await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
    }
}

function writeWarnData(data) {
    try {
        fs.writeFileSync(warnFilePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log('Warn data successfully written to file.');
    } catch (error) {
        console.error('Error writing to warn data file:', error);
    }
}

// Function to reset warn count for a specific user
function resetWarn(participantId) {
    if (warnData[participantId]) {
        warnData[participantId].count = 0;
    } else {
        warnData[participantId] = { count: 0, fromGroup: '' };
    }

    // Save the updated data back to the file
    fs.writeFileSync(warnFilePath, JSON.stringify(warnData, null, 2), 'utf8');
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        // if (m.messages[0].key.fromMe) return; // Ignore messages from self   

        const message = m.messages[0].message;

        // let textMessage;
        // if (message.message?.conversation) {
        //     textMessage = message.message.conversation;
        // } else if (message.message?.extendedTextMessage?.text) {
        //     textMessage = message.message.extendedTextMessage.text;
        // } else {
        //     console.log('Received message without text:', m.messages[0]);
        //     return;
        // }
    
        console.log(message);

        if (!message) {
            console.log('Received message without content:', m.messages[0]);
            return;
        }

        const text = message.conversation || message.extendedTextMessage?.text || message.imageMessage?.caption;
        const messageText = text

        // Logging received message

        // Determine if message is from a group or private chat
        const chat = m.messages[0].key.remoteJid;
        console.log(chat)
        const isGroup = chat.endsWith('@g.us'); // Check if chat is a group
        const senderNumber = m.messages[0].key.participant || m.messages[0].key.remoteJid;
        const groupMetadata = await sock.groupMetadata(chat);
        const senderIsAdmin = groupMetadata.participants.some(p => p.id === senderNumber && (p.admin === 'admin' || p.admin === 'superadmin'));
        const participantId = m.messages[0].key.fromMe ? m.messages[0].key.remoteJid : m.messages[0].key.participant;
        userNames = {};
        console.log('is sender admin: ' + senderIsAdmin)
        if (message.imageMessage) {
            const caption = message.imageMessage.caption?.toLowerCase();
            if (caption && caption.startsWith('!deepimg')) {
                const parts = caption.split(' ');
                const enhancementType = parts[1];
    
                if (enhancementType) {
                    try {
                        const media = await sock.downloadMediaMessage(m.messages[0]);
                        const imageUrl = await uploadImageToHost(media); // Implement this function to upload image and get URL
                        const enhancedImageUrl = await handleDeepImageCommand(imageUrl, enhancementType);
    
                        await sock.sendMessage(chat, {
                            image: { url: enhancedImageUrl },
                            caption: 'Berikut adalah gambar yang sudah ditingkatkan kualitasnya.'
                        });
                        console.log('Enhanced image sent.');
                    } catch (error) {
                        console.error('Error enhancing image:', error);
                        await sock.sendMessage(chat, { text: 'Gagal meningkatkan kualitas gambar. Pastikan gambar yang dikirim valid.' });
                    }
                } else {
                    await sock.sendMessage(chat, { text: 'Tolong berikan jenis peningkatan setelah !deepimg. Contoh: !deepimg denoise' });
                }
            }
        }

        if (isGroup) {
            // if(messageText.startsWith('p')) {
            //     const participants = (await sock.groupMetadata(chat)).participants;
            //     const allMemberIds = participants.map(participant => participant.id);
    
            //     const messageToSend = messageText.slice(2).trim(); // Menghapus "!hidetag " dari pesan
            //         console.log('hidetaged!');
            //         await sock.sendMessage(chat, { text: messageToSend, mentions: allMemberIds });
            // }

            // console.log(JSON.stringify(m, null, 2));

            if (messageText && messageText.startsWith('!')) {
                const command = messageText.slice(1).split(' ')[0];
                const args = messageText.slice(command.length + 1).trim(); // Mendapatkan arguments (kata kedua dan seterusnya)

                console.log(`Group Command: ${command}`);
                console.log(`Group Arguments: ${args}`);
                
                try {
                    switch (command) {
                        case 'chatgpt' :
                            if(args) {
                                await sock.sendMessage(chat, { text : '_Kuota api anda sudah habis_'})
                            } else {
                                await sock.sendMessage(chat, { text : 'Mana promptnya?'})
                            }
                            break
                        case 'warn':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0];
                                    const groupMetadata = await sock.groupMetadata(chat);
                                    const groupSubjects = groupMetadata.subject;
                                    const groupSubject = groupSubjects.trim();
                                
                                    await addWarn(participantId, groupSubject, sock, chat);
                                } else {
                                    await sock.sendMessage(chat, { text: 'Format perintah salah. Gunakan !warn @tag_peserta' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Hanya admin grup yang dapat menggunakan perintah ini.' });
                            }
                            break;
                        case 'cekwarn':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0];
                                    const warnCount = getWarnCount(participantId);
                                
                                    try {
                                        const groupMetadata = await sock.groupMetadata(chat);
                                        const participant = groupMetadata.participants.find(p => p.id === participantId);
                                    
                                        if (!participant) {
                                            console.log(`Participant with ID ${participantId} not found in group metadata.`);
                                        }
                                    
                                        // Jika nama pengguna tidak ditemukan, gunakan ID
                                        // const userName = participant ? participantId.split('@')[0] : undefined;
                                        console.log(`Sending message to: @${participantId.split('@')[0]}, Warn count: ${warnCount}/3`);
                                    
                                        await sock.sendMessage(chat, { text: `@${participantId.split('@')[0]} *warn count: ${warnCount}/3*` }, { mentions: [participantId] });
                                    } catch (error) {
                                        console.error("Error fetching group metadata:", error);
                                        await sock.sendMessage(chat, { text: 'Terjadi kesalahan saat memproses perintah ```cekwarn```' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: 'Format perintah salah. Gunakan !cekwarn @tag_peserta' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Hanya admin grup yang dapat menggunakan perintah ini.' });
                            }
                            break;
                        case 'resetwarn':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0];
                                    resetWarn(participantId);
                                
                                    try {
                                        const groupMetadata = await sock.groupMetadata(chat);
                                        const participant = groupMetadata.participants.find(p => p.id === participantId);
                                    
                                        // Cek apakah participant ditemukan
                                        if (!participant) {
                                            console.log(`Participant with ID ${participantId} not found in group metadata.`);
                                        }
                                    
                                        // Jika nama pengguna tidak ditemukan, gunakan ID
                                        const userName = participant ? participantId.split('@')[0] : undefined;

                                        await sock.sendMessage(chat, { text: `@${userName} *warn count has been reset.*` }, { mentions: [participantId] });
                                    } catch (error) {
                                        console.error("Error fetching group metadata:", error);
                                        await sock.sendMessage(chat, { text: 'Terjadi kesalahan saat memproses perintah resetwarn.' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: 'Format perintah salah. Gunakan !resetwarn @tag_peserta' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Hanya admin grup yang dapat menggunakan perintah ini.' });
                            }
                            break;
                        case 'groupuuid':
                            try {
                                const groupId = m.key?.remoteJid || m.chat || m.messages?.[0]?.key?.remoteJid;

                                const groupMetadata = await sock.groupMetadata(groupId);
                                const groupSubject = groupMetadata.subject;
                                const groupName = groupSubject.trim();
                                // if (groupId === '120363301721968616@g.us') {
                                //     // Lakukan sesuatu jika groupId sesuai
                                //     console.log('Ini adalah grup yang diinginkan.');
                                //     // Tambahkan logika atau perintah yang ingin dilakukan di sini
                                // } else {
                                //     console.log('Ini bukan grup yang diinginkan.');
                                // }

                                await sock.sendMessage(chat, {text:`UUID dari grup *${groupName}* adalah: ` + groupId})
                            } catch (err) {
                                console.error('Error:', err);
                            }
                            break;
                        case 'menu':
                            try {
                                // Cek objek m secara keseluruhan untuk memahami strukturnya
                                console.log(JSON.stringify(m, null, 2));
                            
                                // Mendapatkan ID grup dari lokasi yang tepat di objek m
                                const groupId = m.key?.remoteJid || m.chat || m.messages?.[0]?.key?.remoteJid || 'unknown-id';

                                if (groupId === 'unknown-id') {
                                    throw new Error("Group ID not found");
                                }
                            
                                // Ambil ID peserta dari chat dengan pengecekan lebih komprehensif
                                const participantId = m.key?.participant || m.messages?.[0]?.key?.participant || 'unknown-participant';
                            
                                // Balasan dengan ID peserta yang disebutkan dan daftar perintah
                                await sock.sendMessage(groupId, {
                                    text: `Oke @${participantId.split('@')[0]}, berikut daftar perintah yang bisa kamu gunakan:\n\n` +
                                    '1. `!private` or `!public` (change mode to public or private) - Admin grup only\n' +
                                    '2. `!voice` (feature not implemented yet)\n\n' +
                                    '3. `!tiktok` (feature not implemented yet)\n\n' +
                                    '4. `!pinterest` (feature not implemented yet)\n\n' +
                                    '5. `!ytm4a` (feature not implemented yet)\n\n' +
                                    '6. `!opengroup` or `!closegroup` (open/close grup) - Admin grup only\n\n' +
                                    '7. `!menu` (show menu)\n\n' +
                                    '8. `!lily` (fotoku)\n\n' +
                                    '9. `!ytmp4` (feature not implemented yet)\n\n' +
                                    '10. `!bard` (feature not implemented yet)\n\n' +
                                    '11. `!txt2img` (feature not implemented yet)\n\n' +
                                    '12. `!call` (call someone) - gatau bisa apa kga\n\n' +
                                    '13. `!callme` (what should i call u?)\n\n' +
                                    '14. `!promote` (promote member) - admin only\n\n' +
                                    '15. `!demote` (demote admin) - admin only',
                                    mentions: [participantId] // Mention participant ID
                                });
                            } catch (error) {
                                console.error("Error in 'menu' command:", error);
                                await sock.sendMessage(m.key?.remoteJid || m.chat || 'unknown-id', { text: 'Terjadi kesalahan saat memproses perintah menu.' });
                            }
                            break;
                        case 'private':
                            if (senderIsAdmin) {
                                const groupId = m.key?.remoteJid || m.chat || m.messages?.[0]?.key?.remoteJid;
                                try {
                                    await sock.groupSettingUpdate(groupId, 'announcement');
                                    await sock.sendMessage(chat, { text: `_Mode grup berubah menjadi private_` });
                                } catch (err) {
                                    console.error('Error change group mode:', err);
                                    await sock.sendMessage(chat, { text: '```Terjadi kesalahan saat mengubah mode grup.```' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
                            }
                            break;
                        case 'public':
                            if (senderIsAdmin) {
                                const groupId = m.key?.remoteJid || m.chat || m.messages?.[0]?.key?.remoteJid;
                                try {
                                    await sock.groupSettingUpdate(groupId, 'not_announcement');
                                    await sock.sendMessage(chat, { text: `_Mode grup berubah menjadi private_` });
                                } catch (err) {
                                    console.error('Error change group mode:', err);
                                    await sock.sendMessage(chat, { text: '```Terjadi kesalahan saat mengubah mode grup.```' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
                            }
                            break;
                        case 'quote':
                            try {
                                await sock.sendMessage(chat, { text: '> ' + args})
                            }
                            catch(err) {
                                console.error("Error in 'quote' command:", err)
                            }
                            break;
                        case 'promote':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0]; // Mengambil ID peserta pertama yang di-mention
                                    const participants = (await sock.groupMetadata(chat)).participants;
                                    const participant = participants.find(p => p.id === participantId);
                                    if (participant) {
                                        if (participant.admin === 'admin' || participant.admin === 'superadmin') {
                                            await sock.sendMessage(chat, { text: `@${participantId.split('@')[0]} _sudah menjadi admin._`, mentions: [participantId] });
                                        } else {
                                            try {
                                                await sock.groupParticipantsUpdate(chat, [participantId], 'promote');
                                                await sock.sendMessage(chat, { text: `_Berhasil mengangkat_ @${participantId.split('@')[0]} _menjadi admin grup._`, mentions: [participantId] });
                                            } catch (err) {
                                                console.error('Error promoting participant:', err);
                                                await sock.sendMessage(chat, { text: '```Terjadi kesalahan saat mencoba mempromosikan peserta.```' });
                                            }
                                        }
                                    } else {
                                        await sock.sendMessage(chat, { text: '_Peserta tidak ditemukan dalam grup._' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: '```Format perintah salah. Gunakan``` `!promote @tag_peserta`' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
                            }
                            break;
                        case 'demote':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0];
                                    const groupMetadata = await sock.groupMetadata(chat);
                                    const participant = groupMetadata.participants.find(p => p.id === participantId);
                                    
                                    if (participant) {
                                        // Cek apakah participant adalah admin
                                        const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
                                        if (isAdmin) {
                                            try {
                                                await sock.groupParticipantsUpdate(chat, [participantId], 'demote');
                                                await sock.sendMessage(chat, { text: `Berhasil menurunkan @${participantId.split('@')[0]} dari admin.`, mentions: [participantId] });
                                            } catch (err) {
                                                console.error('Error demoting participant:', err);
                                                await sock.sendMessage(chat, { text: 'Terjadi kesalahan saat mencoba menurunkan peserta.' });
                                            }
                                        } else {
                                            await sock.sendMessage(chat, { text: `Peserta @${participantId.split('@')[0]} bukan admin.` });
                                        }
                                    } else {
                                        await sock.sendMessage(chat, { text: 'Peserta tidak ditemukan dalam grup.' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: 'Format perintah salah. Gunakan !demote @nomor_peserta.' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
                            }
                            break;
                        case 'tes':
                            await sock.sendMessage(chat, { text: '_tes mulu hdh_' });
                            break;
                        case 'kick':
                            if (senderIsAdmin) {
                                const mentions = m.messages[0].message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                if (mentions.length > 0) {
                                    const participantId = mentions[0]; // Mengambil ID peserta pertama yang di-mention
                                    const participants = (await sock.groupMetadata(chat)).participants;
                                    const participant = participants.find(p => p.id === participantId);
                                    if (participant) {
                                        try {
                                            await sock.groupParticipantsUpdate(chat, [participantId], 'remove');
                                            await sock.sendMessage(chat, { text: `_Berhasil mengeluarkan_ @${participantId.split('@')[0]} _dari grup._`, mentions: [participantId] });
                                        } catch (err) {
                                            console.error('Error removing participant:', err);
                                            await sock.sendMessage(chat, { text: '```Terjadi kesalahan saat mencoba mengkick peserta.```' });
                                        }
                                    } else {
                                        await sock.sendMessage(chat, { text: '_Peserta tidak ditemukan dalam grup._' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: '```Format perintah salah. Gunakan``` `!kick @tag_peserta`' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: '_Hanya admin grup yang dapat menggunakan perintah ini._' });
                            }
                            break;
                            case 'add':
                                if (senderIsAdmin) {
                                    if (args.startsWith('+') || args.startsWith('0')) {
                                        const phoneNumber = args.replace(/\D/g, '');
                                        const formattedPhoneNumber = phoneNumber.startsWith('0') ? '62' + phoneNumber.slice(1) + '@c.us' : phoneNumber.startsWith('62') ? phoneNumber + '@c.us' : '62' + phoneNumber + '@c.us';

                                        console.log(`Adding phone number: ${formattedPhoneNumber}...`);

                                        const groupMetadata = await sock.groupMetadata(chat);
                                        console.log('Group Metadata:', groupMetadata);

                                        // const botId = sock.user.id;
                                        // console.log('Bot ID:', botId);

                                        // const isBotAdmin = groupMetadata.participants.some(participant => {
                                        //     console.log('Participant:', participant);
                                        //     return participant.id === botId && participant.admin !== null;
                                        // });

                                        // console.log('Is Bot Admin:', isBotAdmin);

                                        // if (!isBotAdmin) {
                                        //     await sock.sendMessage(chat, { text: 'Jadikan saya admin 😊' });
                                        //     console.log('Bot is not an admin');
                                        //     return;
                                        // }

                                        const isAlreadyInGroup = groupMetadata.participants.some(participant => participant.id === formattedPhoneNumber);

                                        if (isAlreadyInGroup) {
                                            await sock.sendMessage(chat, { text: `Nomor ${args} sudah ada di grup!` });
                                            console.log(`${formattedPhoneNumber} already added`);
                                            return;
                                        }

                                        await sock.sendMessage(chat, { text: `_Menambahkan_ ${args} _ke grup..._` });

                                        try {
                                            await sock.groupParticipantsUpdate(chat, [formattedPhoneNumber], 'add');
                                            console.log(`Adding ${formattedPhoneNumber} to the group...`);
                                        } catch (error) {
                                            await sock.sendMessage(chat, { text: '```Gagal menambahkan member ke grup.```' });
                                            console.error('Error adding participant:', error);
                                        }
                                    } else {
                                        await sock.sendMessage(chat, { text: '```Format perintah salah. Gunakan:```' + ' `!add +nomor_telepon`' });
                                        console.log('Invalid phone number format');
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: 'Hanya admin grup yang dapat menggunakan perintah ini.' });
                                    console.log('Sender is not an admin');
                                }
                                break;
                        case 'call':
                            if (senderIsAdmin) {
                                if (args.startsWith('+')) {
                                    try {
                                        await sock.sendMessage(chat, { text: `Berhasil menghubungi ${args} dari grup.` });
                                    } catch (error) {
                                        console.error('Error calling:', error);
                                        await sock.sendMessage(chat, { text: 'Gagal menghubungi member dari grup.' });
                                    }
                                }
                            }
                            break;
                        case 'callme':
                            if (messageText.startsWith('!callme ')) {
                                const name = messageText.slice(8).trim(); // Take value after "callme"
                                userNames[senderNumber] = name; // Save value (name)
                                await sock.sendMessage(chat, { text: `Oke, nama kamu adalah _${name}_.` });
                            }
                            break;
                        case 'admin':
                            if (isGroup) {
                                const participants = (await sock.groupMetadata(chat)).participants;
                                const adminIds = participants.filter(participant => participant.admin).map(participant => participant.id);
                        
                                const messageToSend = messageText.slice(7).trim(); // Menghapus "!admin " dari pesan
                                if (messageToSend.length > 0) {
                                    await sock.sendMessage(chat, { text: messageToSend, mentions: adminIds });
                                } else {
                                    await sock.sendMessage(chat, { text: '```Pesan untuk``` `!admin` ```tidak boleh kosong..```\n\n```contoh yang benar:``` `!admin halo`' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Perintah ini hanya dapat digunakan dalam grup.' });
                            }
                            break;
                        case 'hidetag':
                            if (isGroup) {
                                const participants = (await sock.groupMetadata(chat)).participants;
                                const allMemberIds = participants.map(participant => participant.id);

                                const messageToSend = messageText.slice(9).trim(); // Menghapus "!hidetag " dari pesan
                                if (messageToSend.length > 0) {
                                    await sock.sendMessage(chat, { text: messageToSend, mentions: allMemberIds });
                                } else {
                                    await sock.sendMessage(chat, { text: '```Pesan untuk``` `!hidetag` ```tidak boleh kosong..```\n\n```contoh yang benar:``` `!hidetag halo`' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Perintah ini hanya dapat digunakan dalam grup.' });
                            }
                            break;
                        case 'admin':
                            if (isGroup) {
                                const participants = (await sock.groupMetadata(chat)).participants;
                                const admins = participants.filter(participant => participant.isAdmin);
                                
                                if (admins.length > 0) {
                                    const invisibleChar = '\u200B'; // invisible character
                                    const adminMentions = admins.map(admin => invisibleChar).join(' '); // using invisible char for hiding username
                                    const adminIds = admins.map(admin => admin.id);
                                    await sock.sendMessage(chat, { text: `memanggil admin${adminMentions}`, mentions: adminIds });
                                } else {
                                    await sock.sendMessage(chat, { text: 'Tidak ada admin di grup ini.' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Perintah ini hanya dapat digunakan dalam grup.' });
                            }
                            break;
                        case 'lily':
                            try {
                                await sock.sendMessage(chat, sendBeautifulPhoto(sock, m.messages[0]));
                                console.log("image sent")
                            }
                            catch(err) {
                                console.error("can't send photo righ now:", err)
                            }
                            break;
                        case 'deepimg':
                            if (!message.imageMessage) {
                                await sock.sendMessage(chat, { text: 'Tolong kirimkan gambar dengan caption yang mengandung !deepimg denoise, !deepimg deblur, atau !deepimg delight' });
                            }
                            break;
                        case 'ytmp3':
                            if (args) {
                                await downloadAndSendMP3(message, args);
                            } else {
                                await sock.sendMessage(chat, { text: 'Mana linknya?' });
                            }
                            break;
                        case 'search':
                            if (args) {
                                try {
                                    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                                        params: {
                                            key: config.GOOGLE_API_KEY,  // API Key dari .env
                                            cx: config.CX,               // Search Engine ID dari .env
                                            q: args               // Kata kunci pencarian
                                        }
                                    });
                        
                                    const items = response.data.items;
                                    if (items && items.length > 0) {
                                        const topResult = items[0];
                                        const reply = `**${topResult.title}**\n${topResult.snippet}\n[Link](${topResult.link})`;
                                        await sock.sendMessage(chat, { text: reply });
                                    } else {
                                        await sock.sendMessage(chat, { text: 'Tidak ada hasil ditemukan.' });
                                    }
                                } catch (error) {
                                    console.error('Error with search API:', error);
                                    await sock.sendMessage(chat, { text: 'Maaf, terjadi kesalahan saat melakukan pencarian.' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Tolong berikan kata kunci untuk pencarian.' });
                            }
                            break;
                        
                            case 'rem':
                                if (isGroup && senderIsAdmin) {
                                    try {
                                        await sock.groupLeave(chat); 
                                        console.log(`Berhasil meninggalkan grup: ${chat}`);
                                    } catch (error) {
                                        console.error('Gagal meninggalkan grup:', error);
                                        await sock.sendMessage(chat, { text: 'Gagal meninggalkan grup.' });
                                    }
                                } else {
                                    await sock.sendMessage(chat, { text: 'Perintah ini hanya dapat digunakan oleh admin grup.' });
                                }
                                break;                            
                        case 'gpt':
                            if (args) {
                                try {
                                    const response = await openai.chat.completions.create({
                                        model: "gpt-3.5-turbo", // Anda bisa memilih model lain yang sesuai
                                        messages: [{ role: "user", content: args }],
                                        max_tokens: 150,
                                        temperature: 0.7,
                                    });
                
                                    const gptReply = response.choices[0].message.content.trim();
                                    await sock.sendMessage(chat, { text: gptReply });
                                    console.log('Prompt sent');
                                } catch (error) {
                                    console.error('Error with GPT API:', error);
                                    await sock.sendMessage(chat, { text: 'Maaf, terjadi kesalahan saat memproses permintaan GPT.' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Tolong berikan pertanyaan atau pernyataan untuk GPT.' });
                            }
                            break;
                        case 'tiktok':
                            if (args) {
                                try {
                                    const videoMeta = await TikTokScraper.getVideoMeta(args, { noWaterMark: true });
                                    console.log('Video Metadata:', videoMeta);

                                    const videoBuffer = await TikTokScraper.downloadVideo(args, { noWaterMark: true });

                                    await sock.sendMessage(chat, {
                                        video: { url: videoBuffer }, // Mengirim video dari URL jika menggunakan buffer
                                        caption: 'Here is your TikTok video!'
                                    });
                                    console.log('TikTok video sent.');
                                } catch (error) {
                                    console.error('Error downloading TikTok video:', error);
                                    await sock.sendMessage(chat, { text: 'Gagal mendownload video TikTok. Pastikan link yang diberikan valid.' });
                                }
                            } else {
                                await sock.sendMessage(chat, { text: 'Mana linknya?' });
                            }
                            break;                     
                        default:
                            const errorCmd = 'Perintah `' + command + '` tidak dikenal. Gunakan `!menu` untuk melihat daftar perintah';
                            await sock.sendMessage(chat, { text: errorCmd });
                            console.log(`command ${command} not found`);
                            break;
                    }
                } catch (error) {
                    const errorCmd = '```Terjadi kesalahan saat memproses perintah``` `' + command + '`';
                    console.error('Error handling command:', error);
                    await sock.sendMessage(chat, { text: errorCmd });
                }
            }
        } else {
            if((messageText && messageText.startsWith('.')) || (messageText && messageText.startsWith('/'))) {
                const command = messageText.slice(1).split(' ')[0];
                const args = messageText.slice(command.length + 1).trim(); // Mendapatkan arguments (kata kedua dan seterusnya)
    
                console.log(`Private Command: ${command}`);
                console.log(`Private Arguments: ${args}`);

                switch(command) {
                    case 'menu':
                        await sock.sendMessage(chat, {
                            text: `\tOke @${participantId.split('@')[0]}, berikut daftar perintah yang bisa kamu gunakan:\n\n` +
                            '1. `!self` or `!public` (change mode to public or private) - Admin grup only\n' +
                            '2. `!voice` (feature not implemented yet)\n\n' +
                            '3. `!tiktok` (feature not implemented yet)\n\n' +
                            '4. `!pinterest` (feature not implemented yet)\n\n' +
                            '5. `!ytm4a` (feature not implemented yet)\n\n' +
                            '6. `!opengroup` or `!closegroup` (open/close grup) - Admin grup only\n\n' +
                            '7. `!menu` (show menu)\n\n' +
                            '8. `!lily` (fotoku)\n\n' +
                            '9. `!ytmp4` (feature not implemented yet)\n\n' +
                            '10. `!bard` (feature not implemented yet)\n\n' +
                            '11. `!txt2img` (feature not implemented yet)\n\n' +
                            '12. `!call` (call someone) - gatau bisa apa kga\n\n' +
                            '13. `!callme` (what should i call u?)\n\n' +
                            '14. `!promote` (promote member) - admin only\n\n' +
                            '15. `!demote` (demote admin) - admin only',
                        });
                }
            }
        }
    });

    groupLeave(sock);
    groupJoin(sock);

    async function sendBeautifulPhoto(client, message) {
        const chatId = message.key.remoteJid;
    
        try {
            const imagePath = path.join(__dirname, '/lily-profile.jpeg');
            const imageBuffer = fs.readFileSync(imagePath);
    
            // Kirim gambar menggunakan Baileys
            await client.sendMessage(chatId, {
                image: imageBuffer,
                caption: '*Ini dia fotoku! 😊*'
            });
    
            console.log('Image sent');
        } catch (error) {
            console.error('Error sending image:', error);
    
            // Kirim pesan error jika ada masalah saat mengirim gambar
            await client.sendMessage(chatId, { text: 'Maaf, aku tidak bisa mengirimkan foto saat ini.' });
        }
    }

    return sock;
}

connectToWhatsApp();