export default async function handler(req, res) {
    const { url } = req.query;
    const apiKey = req.headers['x-api-key'];
    
    if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL y API Key requeridas' });
    }
    
    try {
        const response = await fetch(url, {
            headers: {
                'api_key': apiKey,
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}