// ==========================
// CONFIGURACIÓN BÁSICA
// ==========================

const API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxdWlqb3Rlcm9Ab3V0bG9vay5lcyIsImp0aSI6IjQwMzhlYzI5LTg0ZDUtNGQxNS1iMDBkLTUwOWE0NmI5NjhjYSIsImlzcyI6IkFFTUVUIiwiaWF0IjoxNzQxNTUzNTE0LCJ1c2VySWQiOiI0MDM4ZWMyOS04NGQ1LTRkMTUtYjAwZC01MDlhNDZiOTY4Y2EiLCJyb2xlIjoiIn0.P6gmbNhBkvOo1LfkDw54uISVFuJxuGmc36FmqMZhgOU"; // Pon aquí tu API Key real de AEMET
let CODIGO_MUNICIPIO = "14021";        // Córdoba (mantengo por defecto)
// Default: estación por defecto (se puede cambiar con el select)
let ID_ESTACION = "5402";              // Córdoba Aeropuerto (modificable dinámicamente)
const API_BASE = "https://opendata.aemet.es/opendata"; // BasePath de la doc

// Cargamos fichero de estaciones una vez
let ESTACIONES = []; // array completo de estaciones (cargado desde JSON)

// Add a global cache for municipos once loaded
let MUNICIPIOS = []; // array of {codigo, nombre, provincia, filaRaw}

function validaApiKey() {
  if (!API_KEY || typeof API_KEY !== "string" || API_KEY.trim().length < 10 || API_KEY === "TU_API_KEY_AEMET_AQUI") {
    throw new Error("Falta la API Key de AEMET. Edita el código y rellena la constante API_KEY.");
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

async function fetchAemet(ruta) {
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
}

// ==========================
// TIEMPO ACTUAL (OBSERVACIÓN)
// ==========================

// Helper: actualiza solo el campo de temperatura (no reescribe todo el contenedor)
function muestraTemperatura(valor) {
  const el = document.getElementById("temp-actual");
  if (!el) return;
  if (valor === null || valor === undefined || isNaN(Number(valor))) {
    el.innerHTML = '--<span>°C</span>';
  } else {
    el.innerHTML = `${Number(valor).toFixed(1)}<span>°C</span>`;
  }
}

// Helpers para otros datos
function muestraHumedad(valor) {
  const el = document.getElementById("humedad-actual");
  if (!el) return;
  el.textContent = `Humedad: ${valor != null && isFinite(Number(valor)) ? Math.round(Number(valor)) + ' %' : '-- %'}`;
}

function muestraPresion(valor) {
  const el = document.getElementById("presion-actual");
  if (!el) return;
  el.textContent = `Presión: ${valor != null && isFinite(Number(valor)) ? Number(valor).toFixed(1) + ' hPa' : '-- hPa'}`;
}

function muestraActualizado(texto) {
  const el = document.getElementById("actualizado-actual");
  if (!el) return;
  el.textContent = `Actualizado: ${texto || '--'}`;
}

// Garantiza que existan los elementos current (si algún innerHTML los borró)
function garantizaPlaceholdersCurrentMain() {
  const cont = document.querySelector(".current-main");
  if (!cont) return;

  if (!cont.querySelector("#temp-actual")) {
    cont.insertAdjacentHTML("afterbegin", '<div class="current-temp" id="temp-actual">--<span>°C</span></div>');
  }
  if (!cont.querySelector("#humedad-actual")) {
    cont.querySelector(".current-extra")?.insertAdjacentHTML("afterbegin", '<span id="humedad-actual">Humedad: -- %</span>');
  }
  if (!cont.querySelector("#presion-actual")) {
    cont.querySelector(".current-extra")?.insertAdjacentHTML("beforeend", '<span id="presion-actual">Presión: -- hPa</span>');
  }
  if (!cont.querySelector("#actualizado-actual")) {
    cont.querySelector(".current-extra")?.insertAdjacentHTML("beforeend", '<span id="actualizado-actual">Actualizado: --</span>');
  }
}

// Reemplaza contiene previous implementación de cargaTiempoActual() por esta versión robusta
async function cargaTiempoActual() {
  garantizaPlaceholdersCurrentMain();
  muestraTemperatura(null);
  muestraHumedad(null);
  muestraPresion(null);
  muestraActualizado(null);
  limpiaError("error-actual");

  try {
    validaApiKey();

    // Usamos la estación seleccionada (ID_ESTACION) para observación
    const ruta = `/api/observacion/convencional/datos/estacion/${ID_ESTACION}`;
    const datos = await fetchAemet(ruta);

    if (!Array.isArray(datos) || datos.length === 0) {
      muestraTemperatura(null);
      muestraExtra("Sin datos actuales");
      throw new Error("Sin observaciones");
    }

    // Elige el primer registro válido (último disponible)
    // Algunos endpoints devuelven array con el último primero, otros no; preferimos el último por fecha
    datos.sort((a,b) => new Date(a.fint || a.fenomeno) - new Date(b.fint || b.fenomeno));
    const reg = datos[datos.length - 1];

    const temp = reg.ta ?? reg.temperature ?? reg.tamin ?? reg.tamax ?? null;
    const hum = reg.hr ?? reg.humedad ?? reg.h ?? null;
    const pres = reg.pres ?? reg.qnh ?? null;
    const fecha = new Date(reg.fint || reg.fenomeno || Date.now()).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

    muestraTemperatura(temp);
    muestraHumedad(hum);
    muestraPresion(pres);
    muestraActualizado(fecha);

    // Actualiza chips y etiqueta de estación si existen
    const chipEst = document.getElementById("chip-estacion");
    if (chipEst) chipEst.textContent = `ID estación: ${ID_ESTACION}`;
    const chipFecha = document.getElementById("chip-fecha");
    if (chipFecha) chipFecha.textContent = new Date(reg.fint || reg.fenomeno || Date.now()).toLocaleDateString("es-ES");

    // Actualiza estado
    const statusEl = document.getElementById("status-actual");
    if (statusEl) statusEl.textContent = "";

  } catch (err) {
    console.error(err);
    muestraTemperatura(null);
    muestraHumedad(null);
    muestraPresion(null);
    muestraActualizado(null);
    muestraError("error-actual", "No se han podido cargar los datos de observación. Revisa la consola y la conexión/proxy.");
    const statusEl = document.getElementById("status-actual");
    if (statusEl) statusEl.textContent = "Error al cargar";
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

const ICONS_SVG = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></g></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 17.58A4 4 0 0 0 16 14H7.5A4.5 4.5 0 0 1 7.5 5.5 6 6 0 0 1 18 8h1a4 4 0 0 1 0 8z" fill="currentColor" /></svg>`,
  cloudSun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v2M16.24 5.76l-1.42 1.42M20 12h-2M16.24 18.24l-1.42-1.42M8 21v-2M4.76 16.24l1.42-1.42" stroke="currentColor"/><path d="M20 17.58A4 4 0 0 0 16 14H7.5A4.5 4.5 0 0 1 7.5 5.5 6 6 0 0 1 14 9h1" fill="currentColor"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.58A4 4 0 0 0 16 13H7.5A4.5 4.5 0 0 1 7.5 4.5 6 6 0 0 1 14 8h2" fill="currentColor"/><path d="M8 19v3M12 18v4M16 19v3" stroke="currentColor"/></svg>`,
  thunder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 10V3l-2 2M20 16.58A4 4 0 0 0 16 13H7.5A4.5 4.5 0 0 1 7.5 4.5 6 6 0 0 1 14 8h2" fill="currentColor"/><path d="M13 13l-3 6 4-1-2 4" stroke="currentColor"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 17.58A4 4 0 0 0 16 14H7.5A4.5 4.5 0 0 1 7.5 5.5 6 6 0 0 1 14 8h1" fill="currentColor"/><g stroke="currentColor"><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="16" y1="18" x2="16" y2="18"/></g></svg>`,
  fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 17.58A4 4 0 0 0 16 14H7.5A4.5 4.5 0 0 1 7.5 5.5 6 6 0 0 1 14 8h2" fill="currentColor"/><path d="M3 18h18M2 13h20" stroke="currentColor"/></svg>`,
  unknown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor"/><path d="M9.09 9a3 3 0 1 1 5.82 1c0 1.38-1.75 2-2.91 3M12 17h.01" stroke="currentColor"/></svg>`
};

function injectIconStyles() {
  if (document.getElementById("weather-icon-styles")) return;
  const css = `
    .weather-icon { display:inline-flex !important; align-items:center; justify-content:center; vertical-align:middle; --wtc: #0ea5e9; color: var(--wtc) !important; }
    .weather-icon svg { width: 28px !important; height:28px !important; display:block !important; }
    /* asegurar que los rasgos del svg se pinten con currentColor */
    .weather-icon svg * { stroke: currentColor !important; fill: currentColor !important; }
    .forecast-item { display:flex; align-items:center; gap:8px; }
    .forecast-hour { width:48px; font-weight:600; }
    .forecast-desc { min-width:80px; flex:1; }
  `;
  const style = document.createElement("style");
  style.id = "weather-icon-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function mapCieloToIconKey(desc) {
  if (!desc || typeof desc !== "string") return "unknown";
  const s = desc.toLowerCase();
  if (s.includes("tormenta") || s.includes("chub") || s.includes("torrencial")) return "thunder";
  if (s.includes("lluv") || s.includes("lluvia") || s.includes("chaparrón")) return "rain";
  if (s.includes("nieve")) return "snow";
  if (s.includes("niebla") || s.includes("bruma") || s.includes("neblina") || s.includes("calima")) return "fog";
  if (s.includes("despejado") || s.includes("poco nuboso") || s.includes("soleado") || s.includes("sol")) return "sun";
  if (s.includes("intervalos de nubes") || s.includes("intervalos nubosos") || s.includes("nuboso") || s.includes("nubes") || s.includes("cubierto")) return "cloud";
  if (s.includes("nubes altas")) return "cloud";
  if (s.includes("cielo") && s.includes("despejado")) return "sun";
  return "unknown";
}

function createIconElement(key, size = 24, title = "") {
  injectIconStyles();
  console.log("createIconElement", key, size, title); // debug
  const wrapper = document.createElement("span");
  wrapper.className = "weather-icon";
  wrapper.setAttribute("aria-hidden", "false");
  if (title) wrapper.setAttribute("title", title);
  // Creamos el contenido SVG
  const svgHtml = ICONS_SVG[key] || ICONS_SVG.unknown;
  wrapper.innerHTML = svgHtml;
  const svg = wrapper.querySelector("svg");
  if (svg) {
    // Aseguramos namespace (evita problemas de parseo cuando se usa innerHTML)
    if (!svg.getAttribute("xmlns")) {
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("role", "img");
    // Forzamos stroke/fill para que no dependan de reglas externas
    svg.style.stroke = "currentColor";
    svg.style.fill = "currentColor";
    if (title) {
      const titleEl = document.createElement("title");
      titleEl.textContent = title;
      const existing = svg.querySelector("title");
      if (existing) existing.remove();
      svg.prepend(titleEl);
    }
  }
  return wrapper;
}

function getSkyDescriptionFromObservation(obs) {
  // obs may have estadoCielo as array/object/string; try to extract a human message
  if (!obs) return null;
  let desc = null;
  if (Array.isArray(obs.estadoCielo) && obs.estadoCielo.length > 0) {
    // some objetos: {periodo:..., descripcion:..., value:...}
    const el = obs.estadoCielo[0];
    desc = el.descripcion || el.value || el;
  } else if (typeof obs.estadoCielo === "object" && obs.estadoCielo !== null) {
    desc = obs.estadoCielo.descripcion || obs.estadoCielo.value || null;
  } else if (typeof obs.estadoCielo === "string") {
    desc = obs.estadoCielo;
  } else if (obs.descripcion) {
    desc = obs.descripcion;
  } else if (obs.fenomeno) {
    desc = obs.fenomeno;
  }
  return desc || null;
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

    const iconKey = mapCieloToIconKey(item.cielo);
    const iconEl = createIconElement(iconKey, 22, item.cielo || "");

    const hEl = document.createElement("div");
    hEl.className = "forecast-hour";
    hEl.textContent = `${item.hora} h`;

    const tEl = document.createElement("div");
    tEl.className = "forecast-temp";
    tEl.textContent = item.temp != null ? `${item.temp}°C` : "--°C";

    const dEl = document.createElement("div");
    dEl.className = "forecast-desc";
    dEl.textContent = item.cielo || "—";

    div.appendChild(iconEl);
    div.appendChild(hEl);
    div.appendChild(tEl);
    div.appendChild(dEl);
    cont.appendChild(div);
  });

  if (nombreMunicipio) {
    document.getElementById("city-label").textContent = nombreMunicipio;
  }
}

async function cargaPrevision(codigoMunicipio = CODIGO_MUNICIPIO, nombreMunicipio) {
  const statusEl = document.getElementById("status-forecast");
  statusEl.textContent = "Cargando…";
  limpiaError("error-forecast");
  try {
    validaApiKey();
    if (!codigoMunicipio) throw new Error("Código municipio no especificado.");

    // Construye ruta para predicción horaria del municipio (AEMET)
    // Endpoint: /api/prediccion/especifica/municipio/horaria/{codMunicipio}
    const ruta = `/api/prediccion/especifica/municipio/horaria/${codigoMunicipio}`;
    const data = await fetchAemet(ruta);

    // 'data' puede ser un array con objetos 'prediccion' structure -> extract predict hourly
    // dependemos de estructura existente (usa tu implementación ya presente)
    const listaHoras = extraeHorasPrediccion(data);
    pintaPrevision(listaHoras, nombreMunicipio || document.getElementById("city-label").textContent);

    // Actualiza label último update y estado
    const now = new Date();
    document.getElementById("last-update").textContent = now.toLocaleString("es-ES", { hour:"2-digit", minute:"2-digit" });
    statusEl.textContent = " ";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error al cargar";
    muestraError("error-forecast", "No se ha podido obtener la previsión. Revisa la API Key, el código del municipio o inténtalo más tarde.");
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
  try {
    await cargaListaEstaciones();

    // Carga y llena municipios (CSV) antes de pintar previsiones
    try {
      await cargaMunicipiosDesdeCSV();
      llenaSelectMunicipios();
      console.log("Municipios cargados:", MUNICIPIOS.length);
      if (MUNICIPIOS.length === 0) {
        muestraError("error-forecast", "No se han cargado municipios (falta CSV o ruta incorrecta).");
      }
    } catch (e) {
      console.warn("Error cargando municipios en inicializa:", e);
      // no bloqueamos inicialización completa
    }

    const btnRef = document.getElementById("btn-refresca");
    if (btnRef && !btnRef.dataset.listenerAttached) {
      btnRef.addEventListener("click", refrescaDatos);
      btnRef.dataset.listenerAttached = "1";
    }
    await Promise.all([
      cargaTiempoActual(),
      cargaPrevision(),
      cargaHistoricoPresion()
    ]);
  } catch (e) {
    console.error(e);
  }
}

document.getElementById("btn-refresh").addEventListener("click", async () => {
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.textContent = "Actualizando…";
  await inicializa();
  btn.disabled = false;
  btn.textContent = "↻";
});

// Carga y crea las opciones de Provincia y Estación desde el JSON local
async function cargaListaEstaciones() {
  try {
    const resp = await fetch("Estaciones_AEMET_Completo.json");
    if (!resp.ok) throw new Error("No se pudo cargar Estaciones_AEMET_Completo.json");
    ESTACIONES = await resp.json();

    // Provincias (unicas y ordenadas)
    const provincias = Array.from(new Set(ESTACIONES.map(s => s.Provincia).filter(Boolean))).sort((a,b)=> a.localeCompare(b, 'es'));
    const selectProv = document.getElementById("provincia-select");
    selectProv.innerHTML = '<option value="">— Selecciona provincia —</option>';
    provincias.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      selectProv.appendChild(opt);
    });

    // Si la estación por defecto existe en la lista, seleccionamos su provincia y la llenamos
    const estDefault = ESTACIONES.find(e => (e["Código_AEMET"] || e.Codigo_AEMET) == ID_ESTACION);
    if (estDefault) {
      selectProv.value = estDefault.Provincia || "";
      llenaSelectEstaciones(selectProv.value);
      document.getElementById("estacion-select").value = estDefault["Código_AEMET"] || estDefault.Código_AEMET;
      actualizaEtiquetaEstacion();
    } else {
      // Si no, no seleccionar nada
      if (provincias.length) selectProv.value = provincias[0];
      llenaSelectEstaciones(selectProv.value);
    }

    // listeners
    selectProv.addEventListener("change", (e) => llenaSelectEstaciones(e.target.value));
    document.getElementById("estacion-select").addEventListener("change", (e) => {
      ID_ESTACION = e.target.value;
      actualizaEtiquetaEstacion();
      refrescaDatos();
    });
    // Usa un único botón de refresco (en la cabecera)
    const btnRef = document.getElementById("btn-refresca");
    if (btnRef) {
      btnRef.addEventListener("click", (e) => {
        refrescaDatos();
      });
    }
  } catch (err) {
    console.error("Error cargando estaciones:", err);
    // No bloqueamos la app si no puede cargarse el JSON, se usa la estacion por defecto
  }
}

function llenaSelectEstaciones(provincia) {
  const selectEst = document.getElementById("estacion-select");
  selectEst.innerHTML = '<option value="">— Selecciona estación —</option>';
  const estacionesProv = ESTACIONES.filter(s => (s.Provincia || "").trim().toLowerCase() === (provincia || "").trim().toLowerCase());
  estacionesProv.sort((a,b)=> (a.Nombre||"").localeCompare(b.Nombre || "", 'es'));
  estacionesProv.forEach(est => {
    const opt = document.createElement("option");
    opt.value = est["Código_AEMET"] || est.Código_AEMET;
    opt.textContent = `${(est.Nombre || est.Nombre)} — ${opt.value}`;
    selectEst.appendChild(opt);
  });
}

function actualizaEtiquetaEstacion() {
  const el = document.getElementById("station-label");
  const est = ESTACIONES.find(s => (s["Código_AEMET"] || s.Código_AEMET) == ID_ESTACION);
  if (el) {
    el.textContent = est ? `${est.Nombre} — ${ID_ESTACION}` : `Estación ${ID_ESTACION}`;
  }
}

function refrescaDatos() {
  // actualiza datos con la estacion seleccionada
  cargaTiempoActual();
  cargaPrevision();
  cargaHistoricoPresion();
}

// Carga la lista de municipios desde el CSV local (codigos-municipales_UTF8.csv)
async function cargaMunicipiosDesdeCSV(path = "codigos-municipales_UTF8.csv") {
  try {
    const resp = await fetch(path, { cache: "no-cache" });
    if (!resp.ok) {
      console.warn("No se pudo cargar CSV municipios:", resp.status, resp.statusText);
      return [];
    }
    const text = await resp.text();
    // split lines, normalize CRLF
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines.shift();
    const cols = header.split(";").map(h => h.trim().toLowerCase());

    // busca indices utilies en el encabezado
    const idxCodigo = cols.findIndex(c => /cod|codigo|codigoine|municipioine|ine/.test(c)) >= 0
      ? cols.findIndex(c => /cod|codigo|codigoine|municipioine|ine/.test(c))
      : 0;
    const idxNombre = cols.findIndex(c => /municipio|nombre|nom/.test(c)) >= 0
      ? cols.findIndex(c => /municipio|nombre|nom/.test(c))
      : (cols.length > 1 ? 1 : 0);
    const idxProvincia = cols.findIndex(c => /provincia|provinc/.test(c)) >= 0
      ? cols.findIndex(c => /provincia|provinc/.test(c))
      : -1;

    const result = lines.map(line => {
      const parts = line.split(";").map(p => p.trim());
      const codigo = (parts[idxCodigo] || parts[0] || "").replace(/"/g, "");
      const nombre = (parts[idxNombre] || parts[1] || "").replace(/"/g,"");
      const provincia = idxProvincia >= 0 ? (parts[idxProvincia] || "").replace(/"/g,"") : "";
      return { codigo, nombre, provincia, filaRaw: line };
    }).filter(r => r.codigo && r.nombre);

    // almacena globalmente
    MUNICIPIOS = result;
    return result;
  } catch (err) {
    console.warn("Error leyendo CSV municipios:", err);
    return [];
  }
}

function llenaSelectMunicipios() {
  const sel = document.getElementById("municipio-select");
  if (!sel) return;
  sel.innerHTML = "";
  // Opcional: agrega opción de placeholder
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Elige municipio...";
  sel.appendChild(ph);

  MUNICIPIOS.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.codigo;
    opt.textContent = m.provincia ? `${m.nombre} (${m.provincia})` : m.nombre;
    if (m.codigo === CODIGO_MUNICIPIO) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Botón/even listener: toma el código seleccionado y recarga la previsión
(function attachMunicipalListeners() {
  // event listener para botón nuevo
  const btnConsulta = document.getElementById("btn-consulta-municipio");
  if (btnConsulta) {
    btnConsulta.addEventListener("click", async (e) => {
      e.preventDefault();
      const sel = document.getElementById("municipio-select");
      if (!sel) return;
      const codigo = sel.value;
      if (!codigo) {
        muestraError("error-forecast", "Selecciona un municipio antes de consultar.");
        return;
      }
      CODIGO_MUNICIPIO = codigo;
      // busca nombre para etiqueta
      const m = MUNICIPIOS.find(x => x.codigo === codigo);
      await cargaPrevision(codigo, m ? m.nombre : undefined);
    });
  }

  // Quick-change: si cambias select, puedes consultar automáticamente
  const selAuto = document.getElementById("municipio-select");
  if (selAuto) {
    selAuto.addEventListener("change", async () => {
      const codigo = selAuto.value;
      if (!codigo) return;
      const m = MUNICIPIOS.find(x => x.codigo === codigo);
      CODIGO_MUNICIPIO = codigo;
      await cargaPrevision(codigo, m ? m.nombre : undefined);
    });
  }
})();

// Inicializa la aplicación
inicializa();