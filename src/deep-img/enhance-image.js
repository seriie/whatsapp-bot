const axios = require('axios');

async function enhanceImage(imageUrl) {
    try {
        const response = await axios.post(
            'https://api.deepai.org/api/torch-srgan',
            {
                image: imageUrl
            },
            {
                headers: {
                    'Api-Key': '4e255f00-5898-11ef-a4dd-172f678d9c1e' // Ganti dengan API key milikmu
                }
            }
        );

        if (response.data && response.data.output_url) {
            return response.data.output_url; // URL gambar yang sudah ditingkatkan
        } else {
            throw new Error('Image enhancement failed');
        }
    } catch (error) {
        console.error('Error enhancing image:', error);
        throw error;
    }
}

module.exports = { enhanceImage };