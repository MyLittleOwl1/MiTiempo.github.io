<?php
// Configuración
const API_BASE = 'https://opendata.aemet.es/opendata';
// Preferible: define la API key via variable entorno "AEMET_API_KEY" o aquí como fallback
$apiKey = getenv('AEMET_API_KEY') ?: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxdWlqb3Rlcm9Ab3V0bG9vay5lcyIsImp0aSI6IjQwMzhlYzI5LTg0ZDUtNGQxNS1iMDBkLTUwOWE0NmI5NjhjYSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzQxNTUzNTE0LCJ1c2VySWQiOiI0MDM4ZWMyOS04NGQ1LTRkMTUtYjAwZC01MDlhNDZiOTY4Y2EiLCJyb2xlIjoiIn0.P6gmbNhBkvOo1LfkDw54uISVFuJxuGmc36FmqMZhgOU'; // mejor en variable de entorno

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// 1) Obtener la ruta desde la query ?ruta=/api/...
$ruta = isset($_GET['ruta']) ? $_GET['ruta'] : '';
if ($ruta === '' || strncmp($ruta, '/api/', 5) !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Ruta inválida']);
    exit;
}

function fetch_url($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    // Evitar verificar SSL en entornos de dev; quitar en prod
    // curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $data = curl_exec($ch);
    $err = null;
    if (curl_errno($ch)) {
        $err = curl_error($ch);
    }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$data, $code, $err];
}

// 2) Petición META a AEMET
$urlPrimaria = API_BASE . $ruta . '?api_key=' . urlencode($apiKey);
list($respMeta, $codeMeta, $errMeta) = fetch_url($urlPrimaria);
if ($respMeta === false || $codeMeta >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'Error HTTP AEMET (meta)', 'http_code' => $codeMeta, 'curl_error' => $errMeta]);
    exit;
}

$meta = json_decode($respMeta, true);
if (!isset($meta['datos'])) {
    http_response_code(500);
    echo json_encode(['error' => "Respuesta de AEMET sin campo 'datos'", 'meta' => $meta]);
    exit;
}

// 3) Petición DATOS a la URL `datos`
list($respDatos, $codeDatos, $errDatos) = fetch_url($meta['datos']);
if ($respDatos === false || $codeDatos >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'Error HTTP AEMET (datos)', 'http_code' => $codeDatos, 'curl_error' => $errDatos]);
    exit;
}

// Devolvemos los datos tal cual (AEMET ya devuelve JSON)
echo $respDatos;
exit;
