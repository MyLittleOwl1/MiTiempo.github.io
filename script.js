// ==========================
// CONFIGURACIÓN BÁSICA
// ==========================

//const API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxdWlqb3Rlcm9Ab3V0bG9vay5lcyIsImp0aSI6IjQwMzhlYzI5LTg0ZDUtNGQxNS1iMDBkLTUwOWE0NmI5NjhjYSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzQxNTUzNTE0LCJ1c2VySWQiOiI0MDM4ZWMyOS04NGQ1LTRkMTUtYjAwZC01MDlhNDZiOTY4Y2EiLCJyb2xlIjoiIn0.P6gmbNhBkvOo1LfkDw54uISVFuJxuGmc36FmqMZhgOU"; // Pon aquí tu API Key real de AEMET
const CODIGO_MUNICIPIO = "14021";        // Córdoba
const ID_ESTACION = "5402";              // Córdoba Aeropuerto
//const API_BASE = "https://opendata.aemet.es/opendata"; // BasePath de la doc

function validaApiKey() {
  // Si la constante API_KEY no está declarada en el cliente (modo proxy), no validamos.
  if (typeof API_KEY === "undefined") return;

  // Si está declarada, validamos que tenga mínimo sentido.
  const key = API_KEY;
  if (!key || typeof key !== "string" || key.trim().length < 10 || key === "TU_API_KEY_AEMET_AQUI") {
    throw new Error("Falta la API Key de AEMET en el cliente. Edita el código y rellena la constante API_KEY o usa proxy.php.");
  }
}

// ==========================
// UTILIDADES GENERALES
// ==========================

function formateaFecha(fechaTexto) {
  if (!fechaTexto) return "--";
  const fecha = new Date(fechaTexto);
  if (isNaN(fecha.getTime())) return fechaTexto;
  const opciones = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  };
  return fecha.toLocaleString("es-ES", opciones);
}

function muestraError(id, mensaje) {
  const el = document.getElementById(id);
  el.textContent = mensaje;
  el.classList.remove("hidden");
}

function limpiaError(id) {
  const el = document.getElementById(id);
  el.textContent = "";
  el.classList.add("hidden");
}

/*async function fetchAemet(ruta) {
  // ruta: cadena que empieza por "/api/..."
  const urlPrimaria = `${API_BASE}${ruta}?api_key=${encodeURIComponent(API_KEY)}`;
  const respMeta = await fetch(urlPrimaria);
  if (!respMeta.ok) {
    throw new Error(`Error HTTP AEMET (meta): ${respMeta.status}`);
  }

  const meta = await respMeta.json();
  if (!meta.datos) {
    throw new Error("Respuesta de AEMET sin campo 'datos'");
  }

  const respDatos = await fetch(meta.datos);
  if (!respDatos.ok) {
    throw new Error(`Error HTTP AEMET (datos): ${respDatos.status}`);
  }

  const contentType = respDatos.headers.get("content-type") || "";
  const m = contentType.match(/charset=([^;]+)/i);
  const charset = m ? m[1].trim().toLowerCase() : "utf-8";
  const buffer = await respDatos.arrayBuffer();
  const text = new TextDecoder(charset).decode(buffer);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Error parseando JSON de AEMET: " + e.message);
  }
}*/

async function fetchAemet(ruta) {
  const useProxy = (typeof API_KEY === "undefined");
  if (useProxy) {
    const urlProxy = `./proxy.php?ruta=${encodeURIComponent(ruta)}`;
    const resp = await fetch(urlProxy);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Error proxy AEMET: ${resp.status} - ${text.slice(0, 200)}`);
    }

    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const text = await resp.text();

    // Detectar si el servidor devuelve PHP/HTML (respuesta inesperada)
    if (!contentType.includes("application/json") && text.trim().startsWith("<")) {
      throw new Error("Respuesta del proxy no es JSON. Asegura que proxy.php sea ejecutado por un servidor PHP y no accedas por file://");
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("Error parseando JSON desde proxy: " + e.message + " — respuesta: " + text.slice(0,200));
    }
  }

  // Si hay API_KEY en el cliente: mantenemos el flujo original (META -> DATOS)
  const urlMeta = `${API_BASE}${ruta}?api_key=${encodeURIComponent(API_KEY)}`;
  const respMeta = await fetch(urlMeta);
  if (!respMeta.ok) {
    throw new Error(`Error HTTP AEMET (meta): ${respMeta.status}`);
  }
  const meta = await respMeta.json();
  if (!meta.datos) {
    throw new Error("Respuesta de AEMET sin campo 'datos'");
  }

  const respDatos = await fetch(meta.datos);
  if (!respDatos.ok) {
    throw new Error(`Error HTTP AEMET (datos): ${respDatos.status}`);
  }

  const contentType = respDatos.headers.get("content-type") || "";
  const m = contentType.match(/charset=([^;]+)/i);
  const charset = m ? m[1].trim().toLowerCase() : "utf-8";
  const buffer = await respDatos.arrayBuffer();
  const text = new TextDecoder(charset).decode(buffer);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Error parseando JSON de AEMET: " + e.message);
  }
}

// ==========================
// TIEMPO ACTUAL (OBSERVACIÓN)
// ==========================

async function cargaTiempoActual() {
  const statusEl = document.getElementById("status-actual");
  statusEl.textContent = "Cargando…";
  limpiaError("error-actual");

  try {
    validaApiKey();

    const ruta = `/api/observacion/convencional/datos/estacion/${ID_ESTACION}`;
    const data = await fetchAemet(ruta);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Sin datos de observación para la estación indicada.");
    }

    const ultimo = data[data.length - 1];

    const temp = ultimo.ta ?? ultimo.tamin ?? ultimo.tamax ?? null;
    const hum = ultimo.hr ?? null;
    const pres = ultimo.pres ?? ultimo.qnh ?? null;
    const fecha = ultimo.fint ?? ultimo.fenomeno ?? null;

    document.getElementById("temp-actual").innerHTML =
      (temp !== null ? (temp.toFixed ? temp.toFixed(1) : temp) : "--") + "<span>°C</span>";
    document.getElementById("humedad-actual").textContent =
      `Humedad: ${hum !== null ? hum : "--"} %`;
    document.getElementById("presion-actual").textContent =
      `Presión: ${pres !== null ? pres : "--"} hPa`;
    document.getElementById("actualizado-actual").textContent =
      `Actualizado: ${formateaFecha(fecha)}`;

    document.getElementById("station-label").textContent =
      `Estación ${ultimo.nombre || ""}`.trim();
    document.getElementById("chip-estacion").textContent =
      `ID estación: ${ultimo.idema || ID_ESTACION}`;
    document.getElementById("chip-fecha").textContent =
      formateaFecha(fecha);

    statusEl.textContent = "Datos actualizados";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar";
    muestraError(
      "error-actual",
      "No se ha podido obtener el tiempo actual. Revisa la API Key, el ID de estación o inténtalo de nuevo más tarde."
    );
  }
}

// ==========================
// PREVISIÓN 24 HORAS (HORARIA)
// ==========================

function extraeHorasPrediccion(json) {
  if (!Array.isArray(json) || json.length === 0) {
    return [];
  }
  const raiz = json[0];
  const pred = raiz.prediccion;
  if (!pred || !Array.isArray(pred.dia) || pred.dia.length === 0) {
    return [];
  }
  const dia0 = pred.dia[0];

  const tempArray = Array.isArray(dia0.temperatura) ? dia0.temperatura : [];
  const cieloArray = Array.isArray(dia0.estadoCielo) ? dia0.estadoCielo : [];

  const mapaTemp = {};
  tempArray.forEach(t => {
    if (t.periodo != null) {
      mapaTemp[String(t.periodo).padStart(2, "0")] = t.value;
    }
  });

  const mapaCielo = {};
  cieloArray.forEach(c => {
    if (c.periodo != null) {
      mapaCielo[String(c.periodo).padStart(2, "0")] = c.descripcion || c.value || "";
    }
  });

  const horas = Object.keys(mapaTemp)
    .concat(Object.keys(mapaCielo))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  const ahora = new Date();
  const horaActual = ahora.getHours();

  const resultado = [];
  for (let i = 0; i < horas.length; i++) {
    const h = parseInt(horas[i], 10);
    if (h >= horaActual && h < horaActual + 24) {
      resultado.push({
        hora: horas[i],
        temp: mapaTemp[horas[i]],
        cielo: mapaCielo[horas[i]] || ""
      });
    }
  }

  if (resultado.length === 0) {
    return horas.slice(0, 24).map(h => ({
      hora: h,
      temp: mapaTemp[h],
      cielo: mapaCielo[h] || ""
    }));
  }

  return resultado.slice(0, 24);
}

function pintaPrevision(listaHoras, nombreMunicipio) {
  const cont = document.getElementById("forecast-list");
  cont.innerHTML = "";

  if (!listaHoras || listaHoras.length === 0) {
    cont.innerHTML = "<span style='font-size:0.75rem;color:#9ca3af;'>Sin datos de previsión.</span>";
    return;
  }

  listaHoras.forEach(item => {
    const div = document.createElement("div");
    div.className = "forecast-item";

    const hEl = document.createElement("div");
    hEl.className = "forecast-hour";
    hEl.textContent = `${item.hora} h`;

    const tEl = document.createElement("div");
    tEl.className = "forecast-temp";
    tEl.textContent = item.temp != null ? `${item.temp}°C` : "--°C";

    const dEl = document.createElement("div");
    dEl.className = "forecast-desc";
    dEl.textContent = item.cielo || "—";

    div.appendChild(hEl);
    div.appendChild(tEl);
    div.appendChild(dEl);
    cont.appendChild(div);
  });

  if (nombreMunicipio) {
    document.getElementById("city-label").textContent = nombreMunicipio;
  }
}

async function cargaPrevision() {
  const statusEl = document.getElementById("status-forecast");
  const lastUpdateEl = document.getElementById("last-update");
  statusEl.textContent = "Cargando…";
  limpiaError("error-forecast");

  try {
    validaApiKey();

    const ruta = `/api/prediccion/especifica/municipio/horaria/${CODIGO_MUNICIPIO}`;
    const data = await fetchAemet(ruta);

    const listaHoras = extraeHorasPrediccion(data);
    const nombreMunicipio =
      (Array.isArray(data) && data[0] && (data[0].nombre || data[0].municipio)) || "";

    pintaPrevision(listaHoras, nombreMunicipio);

    const elaborado = Array.isArray(data) && data[0] ? data[0].elaborado : null;
    lastUpdateEl.textContent = elaborado
      ? `Elaborado: ${formateaFecha(elaborado)}`
      : "Elaborado: —";

    statusEl.textContent = "Datos actualizados";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar";
    muestraError(
      "error-forecast",
      "No se ha podido obtener la previsión. Revisa la API Key, el código de municipio o inténtalo más tarde."
    );
  }
}

// ==========================
// PRESIÓN HORARIA HOY
// ==========================

async function cargaHistoricoPresion() {
  // Ahora: presión por horas del día actual (no 7 días)
  const statusEl = document.getElementById("status-presion");
  statusEl.textContent = "Cargando…";
  limpiaError("error-presion");

  try {
    validaApiKey();

    // Usamos de nuevo la observación convencional (últimas 24 h de la estación)
    const ruta = `/api/observacion/convencional/datos/estacion/${ID_ESTACION}`;
    const data = await fetchAemet(ruta);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Sin datos de observación para la estación indicada.");
    }

    const hoy = new Date();
    const y = hoy.getUTCFullYear();
    const m = hoy.getUTCMonth();
    const d = hoy.getUTCDate();

    // Filtra solo los registros del día actual (UTC)
    const deHoy = data.filter(reg => {
      const fTexto = reg.fint || reg.fenomeno;
      if (!fTexto) return false;
      const f = new Date(fTexto);
      if (isNaN(f.getTime())) return false;
      return (
        f.getUTCFullYear() === y &&
        f.getUTCMonth() === m &&
        f.getUTCDate() === d
      );
    });

    if (deHoy.length === 0) {
      throw new Error("Sin datos de hoy para la estación.");
    }

    // Ordena por hora ascendente
    deHoy.sort((a, b) => {
      const fa = new Date(a.fint || a.fenomeno);
      const fb = new Date(b.fint || b.fenomeno);
      return fa - fb;
    });

    // Actualiza la fecha en la cabecera (formato dd/mm/aaaa) usando la fecha del primer registro
    const elFechaCab = document.getElementById("presion-fecha");
    if (elFechaCab && deHoy[0]) {
      const fechaRegistro = new Date(deHoy[0].fint || deHoy[0].fenomeno || Date.now());
      elFechaCab.textContent = fechaRegistro.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    }
    
    const tbody = document.getElementById("tabla-presion-cuerpo");
    tbody.innerHTML = "";

    deHoy.forEach(reg => {
      const f = new Date(reg.fint || reg.fenomeno);
      const hora = f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const pres = reg.pres ?? reg.qnh ?? null;
      const temp = reg.ta ?? reg.tamin ?? reg.tamax ?? null;
      const hum = reg.hr ?? reg.humedad ?? reg.h ?? null;

      const tr = document.createElement("tr");

      const tdHora = document.createElement("td");
      tdHora.style.padding = "4px 2px";
      tdHora.textContent = hora;

      const tdPres = document.createElement("td");
      tdPres.style.padding = "4px 2px";
      tdPres.style.textAlign = "right";
      tdPres.textContent =
        pres != null && isFinite(Number(pres)) ? Number(pres).toFixed(1) : "—";

      const tdTemp = document.createElement("td");
      tdTemp.style.padding = "4px 2px";
      tdTemp.style.textAlign = "right";
      tdTemp.textContent =
        temp != null && isFinite(Number(temp)) ? Number(temp).toFixed(1) : "—";

      const tdHum = document.createElement("td");
      tdHum.style.padding = "4px 2px";
      tdHum.style.textAlign = "right";
      tdHum.textContent =
        hum != null && isFinite(Number(hum)) ? Number(hum).toFixed(0) : "—";

      tr.appendChild(tdHora);
      tr.appendChild(tdPres);
      tr.appendChild(tdTemp);
      tr.appendChild(tdHum);
      tbody.appendChild(tr);
    });

    document.getElementById("presion-label").textContent = "CÓRDOBA AEROPUERTO, ESPAÑA";
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar";
    muestraError(
      "error-presion",
      "No se ha podido obtener la presión horaria de hoy. Revisa la API Key, el ID de estación o inténtalo más tarde."
    );
  }
}

// ==========================
// INICIALIZACIÓN
// ==========================

async function inicializa() {
  await Promise.all([
    cargaTiempoActual(),
    cargaPrevision(),
    cargaHistoricoPresion()
  ]);
}

document.getElementById("btn-refresh").addEventListener("click", async () => {
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.textContent = "Actualizando…";
  await inicializa();
  btn.disabled = false;
  btn.textContent = "Actualizar";
});

inicializa();