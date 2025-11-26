<?php
// Configuración
const API_BASE = 'https://opendata.aemet.es/opendata';
const API_KEY  = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxdWlqb3Rlcm9Ab3V0bG9vay5lcyIsImp0aSI6IjQwMzhlYzI5LTg0ZDUtNGQxNS1iMDBkLTUwOWE0NmI5NjhjYSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzQxNTUzNTE0LCJ1c2VySWQiOiI0MDM4ZWMyOS04NGQ1LTRkMTUtYjAwZC01MDlhNDZiOTY4Y2EiLCJyb2xlIjoiIn0.P6gmbNhBkvOo1LfkDw54uISVFuJxuGmc36FmqMZhgOU'; // mejor en variable de entorno

header('Content-Type: application/json; charset=utf-8');

// 1) Obtener la ruta desde la query ?ruta=/api/...
$ruta = isset($_GET['ruta']) ? $_GET['ruta'] : '';
if ($ruta === '' || strncmp($ruta, '/api/', 5) !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Ruta inválida']);
    exit;
}

// 2) Petición META a AEMET
$urlPrimaria = API_BASE . $ruta . '?api_key=' . urlencode(API_KEY);

$respMeta = @file_get_contents($urlPrimaria);
if ($respMeta === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Error HTTP AEMET (meta)']);
    exit;
}

$meta = json_decode($respMeta, true);
if (!isset($meta['datos'])) {
    http_response_code(500);
    echo json_encode(['error' => "Respuesta de AEMET sin campo 'datos'"]);
    exit;
}

// 3) Petición DATOS a la URL `datos`
$respDatos = @file_get_contents($meta['datos']);
if ($respDatos === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Error HTTP AEMET (datos)']);
    exit;
}
