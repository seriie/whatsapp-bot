// deep-image.js
const { denoiseImage, deblurImage, delightImage } = require('./enhance-image');

async function handleDeepImageCommand(imageUrl, enhancementType) {
    try {
        let enhancedImageUrl;
        switch (enhancementType) {
            case 'denoise':
                enhancedImageUrl = await denoiseImage(imageUrl);
                break;
            case 'deblur':
                enhancedImageUrl = await deblurImage(imageUrl);
                break;
            case 'delight':
                enhancedImageUrl = await delightImage(imageUrl);
                break;
            default:
                throw new Error('Jenis peningkatan tidak valid. Gunakan "denoise", "deblur", atau "delight".');
        }
        return enhancedImageUrl;
    } catch (error) {
        throw new Error('Gagal meningkatkan kualitas gambar: ' + error.message);
    }
}

module.exports = { handleDeepImageCommand };
