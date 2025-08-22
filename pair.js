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
                        await delay(3000);
                        const user_jid = jidNormalizedUser(Shamika_PairWeb.user.id);

                        // Set profile picture if image was uploaded and valid
                        if (imagePath && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
                            try {
                                const imageBuffer = fs.readFileSync(imagePath);
                                await Shamika_PairWeb.updateProfilePicture(Shamika_PairWeb.user.id, imageBuffer);
                                
                                const successMsg = '✅ `Profile picture updated successfully!`';
                                console.log(successMsg);
                                await Shamika_PairWeb.sendMessage(user_jid, { text: successMsg });

                                let WizardText = `✅ 𝐘𝐨𝐮𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐚𝐜𝐜𝐨𝐮𝐧𝐭 𝐢𝐬 𝟏𝟎𝟎% 𝐬𝐞𝐜𝐮𝐫𝐞.`;

                                await Shamika_PairWeb.sendMessage(user_jid, {
                                    text: WizardText,
                                });

                                // Logout after successful operation
                                console.log('🔄 Logging out from all linked devices');
                                await Shamika_PairWeb.sendMessage(user_jid, { text: '🔄 Automatically logging out from all linked devices' });
                                
                                await delay(2000);
                                await Shamika_PairWeb.logout();
                                
                                console.log('✅ Successfully logged out');
                                
                            } catch (e) {
                                const errorMsg = `❌ Error updating profile picture: ${e.message}`;
                                console.error(errorMsg);
                                await Shamika_PairWeb.sendMessage(user_jid, { text: errorMsg });
                            } finally {
                                if (fs.existsSync(imagePath)) {
                                    removeFile(imagePath);
                                }
                                
                                // Clean up and exit
                                await delay(100);
                                removeFile('./session');
                                process.exit(0);
                            }
                        } else {
                            // No image provided, just logout
                            console.log('🔄 No image provided, logging out');
                            await Shamika_PairWeb.sendMessage(user_jid, { text: '🔄 Automatically logging out' });
                            
                            await delay(2000);
                            await Shamika_PairWeb.logout();
                            
                            // Clean up and exit
                            await delay(100);
                            removeFile('./session');
                            process.exit(0);
                        }
                    } catch (e) {
                        console.error("❌ Error in connection open:", e);
                        exec('pm2 restart shamika');
                    }
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
