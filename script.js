class GeradorLoteria {
  constructor(tipoJogo) {
    // Configurações de cada jogo
    const CONFIGS = {
      "mega-sena": {
        nome: "Mega-Sena",
        url: "https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/mega-sena.json",
        totalNumeros: 60, // 1 a 60
        minDezenas: 6,
        maxDezenas: 15, // Pode variar, mas 15 é o padrão de segurança
        padraoDezenas: 6,
        exibeZero: false, // Ex: 1 a 60
      },
      lotofacil: {
        nome: "Lotofácil",
        url: "https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/lotofacil.json",
        totalNumeros: 25, // 1 a 25
        minDezenas: 15,
        maxDezenas: 20,
        padraoDezenas: 15,
        exibeZero: false,
      },
      quina: {
        nome: "Quina",
        url: "https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/quina.json",
        totalNumeros: 80, // 1 a 80
        minDezenas: 5,
        maxDezenas: 15,
        padraoDezenas: 5,
        exibeZero: false,
      },
      lotomania: {
        nome: "Lotomania",
        url: "https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/lotomania.json",
        totalNumeros: 100, // 00 a 99
        minDezenas: 50,
        maxDezenas: 50, // Na Lotomania o jogo é fixo em 50
        padraoDezenas: 50,
        exibeZero: true, // Lotomania usa 00
      },
    };

    this.config = CONFIGS[tipoJogo];
    if (!this.config) throw new Error("Jogo não configurado: " + tipoJogo);

    this.historico = [];
    this.bloqueioNumeros = new Set();
    this.bloqueioConcursos = new Set();
    this.status = "carregando";

    // Ajusta os inputs do HTML para os limites do jogo atual
    this.ajustarInterface();
  }

  ajustarInterface() {
    const inputDezenas = document.getElementById("qtdDezenas");
    if (inputDezenas) {
      inputDezenas.min = this.config.minDezenas;
      inputDezenas.max = this.config.maxDezenas;
      inputDezenas.value = this.config.padraoDezenas;

      // Se min e max são iguais (ex: Lotomania), bloqueia o input
      if (this.config.minDezenas === this.config.maxDezenas) {
        inputDezenas.disabled = true;
        inputDezenas.title = "Neste jogo a quantidade é fixa.";
      }
    }

    // Atualiza título da página se necessário
    const titulo = document.querySelector("h2");
    if (titulo && titulo.innerText.includes("Gerador")) {
      titulo.innerHTML = `Gerador <span>${this.config.nome}</span>`;
    }
  }

  async iniciar() {
    const statusEl = document.getElementById("status-api");
    try {
      statusEl.innerText = `🔄 Baixando resultados da ${this.config.nome}...`;

      const response = await fetch(this.config.url);
      if (!response.ok) throw new Error("Erro na rede");

      let dados = await response.json();

      // Normalização Universal
      this.historico = dados.map((item) => {
        return {
          concurso: item.concurso || item.Concurso || 0,
          data: item.data || item.Data || "Data desc.",
          dezenas: item.resultado || item.dezenas || item.Dezenas || [],
        };
      });

      this.historico.sort((a, b) => b.concurso - a.concurso);
      this.processarBloqueios();

      this.status = "pronto";

      if (this.historico.length > 0) {
        statusEl.innerHTML = `✅ Base ${this.config.nome}: <b>${this.historico[0].concurso}</b> concursos.`;
        statusEl.style.color = "#209869";
      }

      this.atualizarTabelaHistorico();
    } catch (error) {
      console.error(error);
      this.status = "erro";
      statusEl.innerText = "⚠️ Erro ao baixar dados. Modo Offline.";
      statusEl.style.color = "#d9534f";
    }
  }

  processarBloqueios() {
    if (!this.historico.length) return;

    // Filtro 1: Últimos 18 números (aprox. 3 jogos na Mega, mas varia nos outros)
    // Para Lotofácil (15 num por jogo), 18 numeros é pouco mais de 1 jogo.
    // Vamos manter a lógica "Últimos 3 Concursos" para o filtro leve
    const ultimos3 = this.historico.slice(0, 3);
    this.bloqueioNumeros.clear();
    ultimos3.forEach((s) => {
      if (Array.isArray(s.dezenas))
        s.dezenas.forEach((d) => this.bloqueioNumeros.add(parseInt(d)));
    });

    // Filtro 2: Últimos 18 Concursos Completos
    const ultimos18 = this.historico.slice(0, 18);
    this.bloqueioConcursos.clear();
    ultimos18.forEach((s) => {
      if (Array.isArray(s.dezenas))
        s.dezenas.forEach((d) => this.bloqueioConcursos.add(parseInt(d)));
    });
  }

  _indiceAleatorioSeguro(range) {
    const MAX_UINT32 = 0xffffffff;
    const maxLimit = Math.floor(MAX_UINT32 / range) * range;
    let randomValue;
    const array = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(array);
      randomValue = array[0];
    } while (randomValue >= maxLimit);
    return randomValue % range;
  }

  gerarJogo(qtdDezenas, tipoFiltro) {
    let pool = [];
    let setBloqueio = null;

    if (tipoFiltro === "leve") setBloqueio = this.bloqueioNumeros;
    if (tipoFiltro === "pesado") setBloqueio = this.bloqueioConcursos;

    // Lógica para Lotomania (0 a 99) vs Outros (1 a N)
    const inicio = this.config.exibeZero ? 0 : 1;
    const fim = this.config.exibeZero ? 99 : this.config.totalNumeros;

    for (let i = inicio; i <= fim; i++) {
      if (setBloqueio && setBloqueio.has(i)) continue;
      pool.push(i);
    }

    if (pool.length < qtdDezenas) {
      throw new Error(`Filtro muito restritivo. Tente diminuir o filtro.`);
    }

    const resultado = [];
    let poolDisponivel = [...pool];

    for (let i = 0; i < qtdDezenas; i++) {
      const range = poolDisponivel.length;
      const idx = this._indiceAleatorioSeguro(range);
      resultado.push(poolDisponivel[idx]);
      poolDisponivel.splice(idx, 1);
    }

    return resultado
      .sort((a, b) => a - b)
      .map((n) => {
        // Formatação especial para Lotomania (0 vira "00")
        if (this.config.exibeZero && n === 0) return "00";
        return n.toString().padStart(2, "0");
      });
  }

  verificarDuplicidade(jogoGerado) {
    if (this.status !== "pronto") return null;
    const assinatura = jogoGerado.join("-");

    return this.historico.find((s) => {
      if (!Array.isArray(s.dezenas)) return false;

      // Padronização para comparação
      const dezenasHist = s.dezenas
        .map((d) => {
          const n = parseInt(d);
          if (this.config.exibeZero && n === 0) return "00";
          return n.toString().padStart(2, "0");
        })
        .sort()
        .join("-");

      return dezenasHist === assinatura;
    });
  }

  // --- Métodos de UI (Iguais, só ajustados para contexto genérico) ---
  atualizarTabelaHistorico() {
    const tbody = document.querySelector("#tabelaHistorico tbody");
    if (!tbody) return;
    const ultimos20 = this.historico.slice(0, 20);
    tbody.innerHTML = ultimos20
      .map(
        (s) => `
            <tr>
                <td>${s.concurso}</td>
                <td>${s.data}</td>
                <td style="color: var(--primary); font-weight:bold;">
                    ${
                      Array.isArray(s.dezenas)
                        ? s.dezenas
                            .map((d) => parseInt(d).toString().padStart(2, "0"))
                            .join(" ")
                        : "-"
                    }
                </td>
            </tr>
        `
      )
      .join("");
  }

  atualizarModalBloqueados(tipoFiltro) {
    const container = document.getElementById("listaBloqueados");
    const desc = document.getElementById("desc-bloqueio");
    let setUsado =
      tipoFiltro === "leve" ? this.bloqueioNumeros : this.bloqueioConcursos;

    desc.innerText = `Mostrando ${setUsado.size} números bloqueados:`;

    const lista = Array.from(setUsado).sort((a, b) => a - b);
    container.innerHTML = lista
      .map((n) => {
        let txt = n.toString().padStart(2, "0");
        if (this.config.exibeZero && n === 0) txt = "00";
        return `<span class="tag">${txt}</span>`;
      })
      .join("");
  }
}

// --- INICIALIZAÇÃO INTELIGENTE ---
document.addEventListener("DOMContentLoaded", () => {
  // Detecta qual jogo carregar baseado num atributo do body (veja passo 2)
  const gameType = document.body.getAttribute("data-game") || "mega-sena";

  const app = new GeradorLoteria(gameType);
  app.iniciar();

  // Eventos (Botões)
  const btnGerar = document.getElementById("btnGerar");
  const chkLeve = document.getElementById("chkExcluir18Numeros"); // "Excluir Recentes"
  const chkPesado = document.getElementById("chkExcluir18Jogos"); // "Excluir Histórico"
  const resultadoDiv = document.getElementById("resultado");

  // Toggle Checkboxes
  if (chkLeve)
    chkLeve.addEventListener("change", () => {
      if (chkLeve.checked) chkPesado.checked = false;
    });
  if (chkPesado)
    chkPesado.addEventListener("change", () => {
      if (chkPesado.checked) chkLeve.checked = false;
    });

  btnGerar.addEventListener("click", () => {
    const qtdJogos = parseInt(document.getElementById("qtdJogos").value);
    const qtdDezenas = parseInt(document.getElementById("qtdDezenas").value);

    let filtro = null;
    if (chkLeve && chkLeve.checked) filtro = "leve";
    if (chkPesado && chkPesado.checked) filtro = "pesado";

    resultadoDiv.innerHTML = "";

    try {
      for (let i = 0; i < qtdJogos; i++) {
        const numeros = app.gerarJogo(qtdDezenas, filtro);
        const jaSaiu = app.verificarDuplicidade(numeros);

        const div = document.createElement("div");
        div.className = "jogo-linha";

        let html = `<div>
                    <span style="font-size:0.8rem; font-weight:bold; color:#777; display:block;">JOGO ${
                      i + 1
                    }</span>
                    <span class="jogo-numeros">${numeros.join(" - ")}</span>
                </div>`;

        if (jaSaiu) {
          div.style.borderLeftColor = "#d9534f";
          div.style.background = "#fff5f5";
          html += `<div class="aviso-premio">⚠️ JÁ SAIU NO CONCURSO ${jaSaiu.concurso}</div>`;
        }
        div.innerHTML = html;
        resultadoDiv.appendChild(div);
      }
    } catch (e) {
      alert(e.message);
    }
  });

  // Modais
  const btnVerBloq = document.getElementById("btnVerBloqueados");
  if (btnVerBloq)
    btnVerBloq.onclick = () => {
      let tipo = null;
      if (chkLeve.checked) tipo = "leve";
      if (chkPesado.checked) tipo = "pesado";
      if (tipo) {
        app.atualizarModalBloqueados(tipo);
        document.getElementById("modalBloqueados").style.display = "block";
      }
    };

  document.getElementById("btnVerHistorico").onclick = () =>
    (document.getElementById("modalHistorico").style.display = "block");
  document.querySelectorAll(".close").forEach(
    (el) =>
      (el.onclick = function () {
        this.parentElement.parentElement.style.display = "none";
      })
  );
  window.onclick = (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  };
});
