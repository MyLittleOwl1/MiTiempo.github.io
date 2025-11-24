export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    
    // Manejar peticiones OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
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
        
        // Copiar headers CORS en la respuesta
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).json(data);
    } catch (error) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: error.message });
    }
}