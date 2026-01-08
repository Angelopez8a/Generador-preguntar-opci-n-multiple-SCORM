/*******************************************************
 * GENERADOR MCQ — CON GLOSARIO LATEX INTEGRADO
 * - Preguntas de opción múltiple (radio o checkbox)
 * - Opciones con editor de segmentos (texto/latex)
 * - Retroalimentación opcional (segmentos)
 * - Exporta paquete SCORM (calificable) o práctica (no calificable)
 *
 * CORRECCIONES:
 * 1) MathJax puede no estar listo (cargado async) => no reventar el script.
 * 2) El botón ❌ debe ser no editable (contentEditable=false) para no “romper” el texto.
 *******************************************************/

document.addEventListener("DOMContentLoaded", () => {
    const contPreguntas = document.getElementById("preguntasContainer");
    const btnAgregarPregunta = document.getElementById("btnAgregarPregunta");
    const btnGenerar = document.getElementById("btnGenerar");
    const salida = document.getElementById("salida");

    let contador = 0;

    // =====================================================
    //  Helpers
    // =====================================================

    function escapeHTML(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function safeTypeset(nodes = null) {
        // ✅ No romper si MathJax aún no cargó
        if (window.MathJax && typeof MathJax.typesetPromise === "function") {
            try {
                return MathJax.typesetPromise(nodes ? nodes : undefined).catch(() => {});
            } catch {
                // no-op
            }
        }
        return Promise.resolve();
    }

    // =====================================================
    //  Motor reutilizable de "editores por segmentos"
    // =====================================================

    function insertarSegmento(editor, tipo) {
        const span = document.createElement("span");
        span.className = `segment ${tipo}`;
        span.contentEditable = "true";
        span.spellcheck = false;
        span.innerHTML = tipo === "texto" ? "Texto…" : "latex";

        const remove = document.createElement("span");
        remove.className = "remove";
        remove.innerHTML = "❌";
        remove.contentEditable = "false"; // ✅ clave
        remove.onclick = (e) => {
            e.stopPropagation();
            span.remove();
        };

        span.appendChild(remove);
        editor.appendChild(span);

        // Poner el cursor dentro del span (antes del ❌)
        placeCaretBeforeRemove(span, remove);

        return span;
    }

    function placeCaretBeforeRemove(span, removeEl) {
        // Coloca el cursor antes del remove, para que escribir sea natural
        try {
            const range = document.createRange();
            range.setStart(span, 0);
            range.setEndBefore(removeEl);

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            span.focus();
        } catch {
            // no-op
        }
    }

    function actualizarPreview(editor, preview) {
        let html = "";

        editor.querySelectorAll(".segment").forEach(seg => {
            const remove = seg.querySelector(".remove");
            // Tomamos el texto del segmento excluyendo el ❌
            let contenido = seg.textContent.replace("❌", "").trim();

            if (seg.classList.contains("latex")) {
                html += `<span>$${contenido}$</span> `;
            } else {
                html += `<span>${escapeHTML(contenido)}</span> `;
            }

            // Reafirmar que ❌ no sea editable (por si el navegador lo “resetea”)
            if (remove) remove.contentEditable = "false";
        });

        preview.innerHTML = html;

        // ✅ MathJax seguro
        safeTypeset([preview]);
    }

    // Target global para insertar desde el glosario
    window.segmentoActivo = null;

    // Función llamada desde glosario.js
    window.insertarDesdeGlosario = function (codigo) {
        if (!window.segmentoActivo) return;

        const remove = window.segmentoActivo.querySelector(".remove");
        window.segmentoActivo.innerHTML = codigo + " ";
        if (remove) {
            remove.contentEditable = "false";
            window.segmentoActivo.appendChild(remove);
        }

        const editor = window.segmentoActivo.closest(".editor");
        const preview = window.segmentoActivo.closest(".editor-wrap").querySelector(".preview-box");
        actualizarPreview(editor, preview);

        // Reposicionar caret
        if (remove) placeCaretBeforeRemove(window.segmentoActivo, remove);
    };

    function abrirGlosarioPara(segmento) {
        window.segmentoActivo = segmento;
        window.open("glosario.html", "glosario", "width=760,height=640,scrollbars=yes");
    }

    function crearEditorWrap(labelText) {
        const wrap = document.createElement("div");
        wrap.className = "editor-wrap";

        wrap.innerHTML = `
      <label>${labelText}</label>

      <div class="row" style="margin-bottom:10px;">
        <button type="button" class="btn-small btnAddText">+ Texto</button>
        <button type="button" class="btn-small btnAddLatex">∑ LaTeX (Glosario)</button>
      </div>

      <div class="editor"></div>
      <div class="preview-box">(Vista previa aparecerá aquí)</div>
    `;

        const editor = wrap.querySelector(".editor");
        const preview = wrap.querySelector(".preview-box");

        wrap.querySelector(".btnAddText").onclick = () => {
            insertarSegmento(editor, "texto");
            actualizarPreview(editor, preview);
        };

        wrap.querySelector(".btnAddLatex").onclick = () => {
            const seg = insertarSegmento(editor, "latex");
            abrirGlosarioPara(seg);
            actualizarPreview(editor, preview);
        };

        // Importante: input/keyup; algunos navegadores con contentEditable se sienten mejor con keyup también
        editor.addEventListener("input", () => actualizarPreview(editor, preview));
        editor.addEventListener("keyup", () => actualizarPreview(editor, preview));

        // Inicial: un segmento de texto guía
        insertarSegmento(editor, "texto");
        actualizarPreview(editor, preview);

        return wrap;
    }

    function leerSegmentos(editor) {
        const segmentos = [];
        editor.querySelectorAll(".segment").forEach(seg => {
            const tipo = seg.classList.contains("latex") ? "latex" : "texto";
            const contenido = seg.textContent.replace("❌", "").trim();
            if (contenido.length > 0) segmentos.push({ tipo, contenido });

            const remove = seg.querySelector(".remove");
            if (remove) remove.contentEditable = "false";
        });
        return segmentos;
    }

    // =====================================================
    //  UI Preguntas + Opciones
    // =====================================================

    function agregarPregunta() {
        contador++;

        const card = document.createElement("div");
        card.className = "card";
        card.dataset.qid = String(contador);

        card.innerHTML = `
      <h2>Pregunta ${contador}</h2>

      <div class="row">
        <div>
          <label>Tipo de respuesta</label>
          <select class="tipoPregunta">
            <option value="single">Única correcta (radio)</option>
            <option value="multi">Múltiples correctas (checkbox)</option>
          </select>
        </div>

        <div>
          <label>Puntos</label>
          <input type="number" class="puntos" min="0" placeholder="(usa puntos por defecto)">
        </div>
      </div>

      <hr class="sep">

      <div class="enunciadoWrap"></div>

      <hr class="sep">

      <div class="row" style="margin-bottom:10px;">
        <div><span class="badge">Opciones</span></div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn-small btnAddOption">+ Agregar opción</button>
        </div>
      </div>

      <div class="optionsContainer"></div>

      <hr class="sep">

      <div class="feedbackWrap"></div>
    `;

        contPreguntas.appendChild(card);

        inicializarPregunta(card);
    }

    btnAgregarPregunta.onclick = agregarPregunta;

    // Primera pregunta al cargar
    agregarPregunta();

    function inicializarPregunta(card) {
        // Enunciado
        const enunciadoWrap = card.querySelector(".enunciadoWrap");
        enunciadoWrap.appendChild(crearEditorWrap("Enunciado"));

        // Feedback
        const feedbackWrap = card.querySelector(".feedbackWrap");
        feedbackWrap.innerHTML = `<h3 style="margin:0 0 10px 0; color:#114b5f;">Retroalimentación (opcional)</h3>`;
        feedbackWrap.appendChild(crearEditorWrap("Si es correcta, muestra:"));
        feedbackWrap.appendChild(crearEditorWrap("Si es incorrecta, muestra:"));

        // Opciones
        const optionsContainer = card.querySelector(".optionsContainer");
        const btnAddOption = card.querySelector(".btnAddOption");

        btnAddOption.onclick = () => agregarOpcion(card);

        // Default: 4 opciones
        for (let i = 0; i < 4; i++) agregarOpcion(card);

        // Ajustar flags cuando cambie tipo
        const tipoSelect = card.querySelector(".tipoPregunta");
        tipoSelect.addEventListener("change", () => {
            actualizarTipoFlags(card);
        });

        actualizarTipoFlags(card);

        // Typeset seguro al crear
        safeTypeset([card]);
    }

    function agregarOpcion(card) {
        const optionsContainer = card.querySelector(".optionsContainer");
        const tipo = card.querySelector(".tipoPregunta").value; // single|multi

        const opt = document.createElement("div");
        opt.className = "option-card";

        opt.innerHTML = `
      <div class="option-top">
        <div class="flag">
          <input class="isCorrect" type="${tipo === "single" ? "radio" : "checkbox"}" name="correct_${card.dataset.qid}">
          <span>Correcta</span>
        </div>

        <div class="option-actions">
          <button type="button" class="btn-small btnDelOpt">Eliminar</button>
        </div>
      </div>

      <div class="optionEditorWrap"></div>
    `;

        opt.querySelector(".btnDelOpt").onclick = () => {
            if (optionsContainer.querySelectorAll(".option-card").length <= 2) {
                alert("Necesitas al menos 2 opciones.");
                return;
            }
            opt.remove();
        };

        const optionEditorWrap = opt.querySelector(".optionEditorWrap");
        optionEditorWrap.appendChild(crearEditorWrap("Texto de la opción"));

        optionsContainer.appendChild(opt);
        actualizarTipoFlags(card);
    }

    function actualizarTipoFlags(card) {
        const tipo = card.querySelector(".tipoPregunta").value;
        const qid = card.dataset.qid;
        const flags = card.querySelectorAll(".isCorrect");

        flags.forEach(chk => {
            chk.type = tipo === "single" ? "radio" : "checkbox";
            chk.name = `correct_${qid}`;
        });
    }

    // =====================================================
    //  Generación de archivos
    // =====================================================

    btnGenerar.onclick = () => {
        const titulo = document.getElementById("tituloActividad").value.trim() || "Cuestionario";
        const ident = document.getElementById("identificadorScorm").value.trim() || "MCQ_GENERATED";
        const modo = document.getElementById("modo").value; // scorm|practica
        const shuffleOpciones = document.getElementById("shuffleOpciones").value === "1";
        const mostrarFeedback = document.getElementById("mostrarFeedback").value === "1";
        const puntosDefecto = parseFloat(document.getElementById("puntosDefecto").value) || 1;

        const preguntas = [];

        document.querySelectorAll("#preguntasContainer .card").forEach(card => {
            const tipo = card.querySelector(".tipoPregunta").value; // single|multi
            const puntos = Number(card.querySelector(".puntos").value || puntosDefecto);

            const enunciadoEditor = card.querySelector(".enunciadoWrap .editor");
            const segmentos = leerSegmentos(enunciadoEditor);

            const opciones = [];
            card.querySelectorAll(".option-card").forEach(optCard => {
                const isCorrect = optCard.querySelector(".isCorrect").checked;
                const editor = optCard.querySelector(".optionEditorWrap .editor");
                const segs = leerSegmentos(editor);
                opciones.push({ segmentos: segs, correcta: isCorrect });
            });

            const fbEditors = card.querySelectorAll(".feedbackWrap .editor");
            const fbCorrecta = leerSegmentos(fbEditors[0]);
            const fbIncorrecta = leerSegmentos(fbEditors[1]);

            preguntas.push({
                segmentos,
                multiple: (tipo === "multi"),
                puntos,
                opciones,
                feedback: { correcta: fbCorrecta, incorrecta: fbIncorrecta }
            });
        });

        // Validaciones mínimas
        for (const [i, p] of preguntas.entries()) {
            if (!p.segmentos.length) {
                alert(`La pregunta ${i + 1} tiene enunciado vacío.`);
                return;
            }
            if (p.opciones.length < 2) {
                alert(`La pregunta ${i + 1} necesita al menos 2 opciones.`);
                return;
            }
            const numCorrectas = p.opciones.filter(o => o.correcta).length;
            if (p.multiple) {
                if (numCorrectas < 1) {
                    alert(`La pregunta ${i + 1} (múltiples) necesita al menos 1 correcta.`);
                    return;
                }
            } else {
                if (numCorrectas !== 1) {
                    alert(`La pregunta ${i + 1} (única) debe tener exactamente 1 correcta.`);
                    return;
                }
            }
        }

        const config = { modo, shuffleOpciones, mostrarFeedback };

        const archivos = [
            { nombre: "index.html", contenido: generarIndex(titulo) },
            { nombre: "estilos.css", contenido: generarEstilos() },
            { nombre: "scorm.js", contenido: generarScormJS(preguntas, config) },
            { nombre: "resultado.html", contenido: generarResultadoHTML(config) },
            { nombre: "imsmanifest.xml", contenido: generarManifest(ident, titulo) }
        ];

        mostrarArchivos(archivos);
    };

    function mostrarArchivos(archivos) {
        salida.innerHTML = "";

        archivos.forEach(arch => {
            const box = document.createElement("div");
            box.className = "card filebox";

            box.innerHTML = `
        <h3>${arch.nombre}</h3>
        <textarea spellcheck="false">${arch.contenido}</textarea>
        <button class="btn descargar">Descargar ${arch.nombre}</button>
      `;

            box.querySelector(".descargar").onclick = () =>
                descargarArchivo(arch.nombre, arch.contenido);

            salida.appendChild(box);
        });
    }

    function descargarArchivo(nombre, contenido) {
        const blob = new Blob([contenido], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(url);
    }
});


// =====================================================
//  Generadores de ARCHIVOS (paquete final)
// =====================================================

function generarIndex(titulo) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>

<script>
window.MathJax = { tex: { inlineMath: [['$', '$']] } };
</script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

<link rel="stylesheet" href="estilos.css">
<script src="scorm.js"></script>
</head>

<body>
<div class="container">
  <h1 class="title">${titulo}</h1>

  <div id="contenedorPreguntas"></div>

  <button class="btn" id="btnEnviar">Enviar</button>
</div>
</body>
</html>`;
}

function generarEstilos() {
    return `
body { background:#eef2f7; font-family:Montserrat, sans-serif; margin:0; }
.container { width:92%; max-width:950px; margin:40px auto; }
.title { text-align:center; font-size:34px; color:#14335d; font-weight:800; margin-bottom:22px; }

.card {
  background:#ffffff;
  padding:22px;
  border-radius:18px;
  box-shadow:6px 6px 14px rgba(0,0,0,0.08),
             -5px -5px 12px rgba(255,255,255,0.95);
  margin-bottom:18px;
}

.qtext { font-size:18px; color:#102a43; line-height:1.45; }
.options { margin-top:14px; display:flex; flex-direction:column; gap:10px; }

.optlabel {
  background:#f7fbff;
  border:1px solid #dce7f3;
  padding:10px 14px;
  border-radius:12px;
  display:flex;
  gap:10px;
  align-items:flex-start;
  cursor:pointer;
  transition:0.2s;
}
.optlabel:hover { background:#e3f0ff; transform:translateY(-1px); }

.btn {
  background:linear-gradient(145deg,#1a73e8,#125cb3);
  color:white;
  padding:14px;
  border:none;
  width:100%;
  border-radius:12px;
  cursor:pointer;
  font-size:17px;
  font-weight:700;
  box-shadow:4px 4px 10px rgba(0,0,0,0.15),
             -3px -3px 10px rgba(255,255,255,0.6);
  transition:0.25s;
}
.btn:hover { background:linear-gradient(145deg,#0f5cc4,#0d4a9c); transform:translateY(-2px); }

.feedback {
  margin-top:12px;
  padding:12px 14px;
  border-radius:12px;
  border:1px solid #dce7f3;
  background:#ffffff;
  color:#102a43;
}

.badge {
  display:inline-block;
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
  border:1px solid #dce7f3;
  background:#f7fbff;
  color:#14335d;
}
`;
}

function generarResultadoHTML(config) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resultado</title>
<link rel="stylesheet" href="estilos.css">
</head>

<body>
<div class="container">
  <h1 class="title">Resultado</h1>

  <p id="frase" style="font-size:20px; font-weight:600; margin-top:10px;"></p>

  <p style="font-size:18px;">
    Tu calificación es: <b id="score"></b>%
  </p>

  <button class="btn" id="btnContinuar">Continuar</button>
</div>

<script>
const FRASES = [
  "🌟 La matemática es el lenguaje en el que está escrito el universo. — Galileo",
  "📐 Una demostración vale más que mil intuiciones.",
  "🧠 Las matemáticas no mienten. — Einstein",
  "📊 Donde hay un número, hay una historia.",
  "∞ El infinito no es un número, es una idea poderosa."
];

document.getElementById("frase").innerText =
  FRASES[Math.floor(Math.random()*FRASES.length)];

document.getElementById("score").innerText =
  localStorage.getItem("scoreFinal") || "0";

document.getElementById("btnContinuar").onclick = () => {
  window.location.href = "https://suayed.fciencias.unam.mx/";
};
</script>
</body>
</html>`;
}

function generarScormJS(preguntas, config) {
    return `
const preguntas = ${JSON.stringify(preguntas)};
const CONFIG = ${JSON.stringify(config)};

// Claves de persistencia (por SCO)
const KEY_SUBMITTED = "mcq_submitted_v1";
const KEY_ANSWERS   = "mcq_answers_v1";
const KEY_SCORE     = "scoreFinal";

function getAPI() {
  return (window.API || window.parent.API || window.top.API || null);
}

let api = null;

document.addEventListener("DOMContentLoaded", () => {
  api = getAPI();

  if (CONFIG.modo === "scorm") {
    if (api) {
      try {
        api.LMSInitialize("");
        const entry = scormGet("cmi.core.entry"); // "ab-initio" | "resume" | ""
        if (entry && String(entry).toLowerCase() === "ab-initio") {
          resetIntentoLocal();
        }
      } catch (e) {
        console.log("⚠ Error al inicializar SCORM:", e);
      }
    } else {
      console.log("⚠ API SCORM no encontrada");
    }
  }

  renderPreguntas();

  const submitted = localStorage.getItem(KEY_SUBMITTED) === "1";
  if (submitted) {
    restaurarRespuestas();
    bloquearUI();
    if (CONFIG.mostrarFeedback) mostrarFeedbackGuardado();

    const btn = document.getElementById("btnEnviar");
    if (btn) {
      btn.textContent = "Ver resultado";
      btn.onclick = () => { window.location.href = "resultado.html"; };
    }
    typesetSeguro();
    return;
  }

  const btn = document.getElementById("btnEnviar");
  if (btn) btn.addEventListener("click", () => calificar());

  typesetSeguro();
});

function renderPreguntas() {
  const cont = document.getElementById("contenedorPreguntas");
  cont.innerHTML = "";

  preguntas.forEach((p, qidx) => {
    const card = document.createElement("div");
    card.className = "card";

    const qhtml = renderSegmentos(p.segmentos);
    const qType = p.multiple ? "checkbox" : "radio";

    let opciones = p.opciones.map((o, oidx) => Object.assign({}, o, { _oidx: oidx }));
    if (CONFIG.shuffleOpciones) opciones = shuffle(opciones);

    let optionsHTML = "<div class=\\"options\\">";
    opciones.forEach((o) => {
      optionsHTML +=
        "<label class=\\"optlabel\\">" +
          "<input type=\\"" + qType + "\\" name=\\"q" + qidx + "\\" value=\\"" + o._oidx + "\\">" +
          "<div>" + renderSegmentos(o.segmentos) + "</div>" +
        "</label>";
    });
    optionsHTML += "</div>";

    const feedbackHTML = (CONFIG.mostrarFeedback)
      ? ("<div class=\\"feedback\\" id=\\"fb_" + qidx + "\\" style=\\"display:none;\\"></div>")
      : "";

    card.innerHTML =
      "<div class=\\"qtext\\">" + qhtml + "</div>" +
      optionsHTML +
      feedbackHTML;

    cont.appendChild(card);
  });
}

function renderSegmentos(segmentos) {
  let html = "";
  segmentos.forEach(seg => {
    if (seg.tipo === "latex") html += "<span>$" + seg.contenido + "$</span> ";
    else html += "<span>" + escapeHTML(seg.contenido) + "</span> ";
  });
  return html;
}

function calificar() {
  const respuestas = capturarRespuestas();

  let total = preguntas.reduce((a, p) => a + p.puntos, 0);
  let obtenido = 0;
  const feedbackPorPregunta = [];

  preguntas.forEach((p, qidx) => {
    const seleccion = respuestas[qidx] || [];

    const correctas = p.opciones
      .map((o, i) => o.correcta ? i : null)
      .filter(v => v !== null);

    let ok = false;
    if (!p.multiple) ok = (seleccion.length === 1 && seleccion[0] === correctas[0]);
    else ok = sameSet(seleccion, correctas);

    if (ok) obtenido += p.puntos;
    feedbackPorPregunta.push(ok ? "correcta" : "incorrecta");

    if (CONFIG.mostrarFeedback) {
      const fb = document.getElementById("fb_" + qidx);
      if (fb) {
        fb.style.display = "block";
        fb.innerHTML = ok ? renderSegmentos(p.feedback.correcta)
                          : renderSegmentos(p.feedback.incorrecta);
      }
    }
  });

  const score = total > 0 ? Math.round((obtenido / total) * 100) : 0;

  localStorage.setItem(KEY_SUBMITTED, "1");
  localStorage.setItem(KEY_ANSWERS, JSON.stringify({
    respuestas: respuestas,
    feedbackPorPregunta: feedbackPorPregunta,
    timestamp: Date.now()
  }));
  localStorage.setItem(KEY_SCORE, String(score));

  if (CONFIG.modo === "scorm") enviarSCORM(score);

  bloquearUI();

  const btn = document.getElementById("btnEnviar");
  if (btn) {
    btn.textContent = "Ver resultado";
    btn.onclick = () => { window.location.href = "resultado.html"; };
  }

  typesetSeguro();

  if (!CONFIG.mostrarFeedback) window.location.href = "resultado.html";
}

function capturarRespuestas() {
  const out = [];
  preguntas.forEach((p, qidx) => {
    const seleccion = Array.from(document.querySelectorAll("input[name='q" + qidx + "']:checked"))
      .map(x => Number(x.value));
    out[qidx] = seleccion;
  });
  return out;
}

function restaurarRespuestas() {
  const raw = localStorage.getItem(KEY_ANSWERS);
  if (!raw) return;

  let data = null;
  try { data = JSON.parse(raw); } catch { return; }
  if (!data || !data.respuestas) return;

  data.respuestas.forEach((arr, qidx) => {
    (arr || []).forEach(val => {
      const input = document.querySelector("input[name='q" + qidx + "'][value='" + val + "']");
      if (input) input.checked = true;
    });
  });
}

function mostrarFeedbackGuardado() {
  const raw = localStorage.getItem(KEY_ANSWERS);
  if (!raw) return;

  let data = null;
  try { data = JSON.parse(raw); } catch { return; }
  if (!data || !data.feedbackPorPregunta) return;

  data.feedbackPorPregunta.forEach((tipo, qidx) => {
    const fb = document.getElementById("fb_" + qidx);
    if (!fb) return;

    fb.style.display = "block";
    fb.innerHTML = (tipo === "correcta")
      ? renderSegmentos(preguntas[qidx].feedback.correcta)
      : renderSegmentos(preguntas[qidx].feedback.incorrecta);
  });
}

function bloquearUI() {
  document.querySelectorAll("input[type='radio'], input[type='checkbox']").forEach(inp => {
    inp.disabled = true;
  });
  document.querySelectorAll(".optlabel").forEach(lab => {
    lab.style.pointerEvents = "none";
    lab.style.opacity = "0.95";
  });
}

function resetIntentoLocal() {
  localStorage.removeItem(KEY_SUBMITTED);
  localStorage.removeItem(KEY_ANSWERS);
  localStorage.removeItem(KEY_SCORE);
}

function scormGet(key) {
  if (!api) return "";
  try { return api.LMSGetValue(key) || ""; } catch { return ""; }
}

function enviarSCORM(score) {
  if (!api) return;

  try {
    api.LMSSetValue("cmi.core.score.raw", score);
    api.LMSSetValue("cmi.core.score.min", 0);
    api.LMSSetValue("cmi.core.score.max", 100);
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    api.LMSCommit("");
    api.LMSFinish("");
    console.log("✔ SCORM enviado:", score);
  } catch (e) {
    console.log("⚠ Error enviando SCORM:", e);
  }
}

function typesetSeguro() {
  if (window.MathJax && typeof MathJax.typesetPromise === "function") {
    MathJax.typesetPromise().catch(() => {});
  }
}

function sameSet(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
`;
}


function generarManifest(ident, titulo) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${ident}"
          version="1.0"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1
                              imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3
                              adlcp_v1p3.xsd">

  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${titulo}</title>
      <item identifier="ITEM1" identifierref="RES1">
        <title>${titulo}</title>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES1"
              type="webcontent"
              adlcp:scormType="sco"
              href="index.html">
      <file href="index.html"/>
      <file href="estilos.css"/>
      <file href="scorm.js"/>
      <file href="resultado.html"/>
    </resource>
  </resources>
</manifest>`;
}
