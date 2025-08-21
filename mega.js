const mega = require("megajs");

const auth = {
    email: "jopodif559@jobzyy.com",
    password: "SHAMika2005$$",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, () => {
                storage.on('error', (error) => {
                    console.error('Storage error:', error);
                    storage.close();
                    reject(error);
                });

                const uploadStream = storage.upload({
                    name: name,
                    allowUploadBuffering: true,
                    maxConnections: 4,
                    maxRetries: 5
                });

                uploadStream.on('error', (error) => {
                    console.error('Upload error:', error);
                    storage.close();
                    reject(error);
                });

                data.pipe(uploadStream);

                storage.on("add", (file) => {
                    file.link((err, url) => {
                        if (err) {
                            console.error('Link generation error:', err);
                            storage.close();
                            reject(err);
                            return;
                        }
                        storage.close();
                        resolve(url);
                    });
                });
            });

            setTimeout(() => {
                if (storage) {
                    storage.close();
                    reject(new Error('Upload timeout after 5 minutes'));
                }
            }, 300000);

        } catch (err) {
            console.error('Unexpected error:', err);
            reject(err);
        }
    });
};

module.exports = { upload };
