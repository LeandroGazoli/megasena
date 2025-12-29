class GeradorMegaSena {
  constructor() {
    this.API_URL =
      "https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/mega-sena.json";
    this.historico = [];

    // Dois sets diferentes de bloqueio
    this.bloqueio18Numeros = new Set(); // Últimos 3 jogos (3x6 = 18 dezenas)
    this.bloqueio18Concursos = new Set(); // Últimos 18 concursos

    this.status = "carregando";
  }

  async iniciar() {
    const statusEl = document.getElementById("status-api");
    try {
      statusEl.innerText = "🔄 Baixando histórico atualizado...";

      const response = await fetch(this.API_URL);
      if (!response.ok) throw new Error("Erro na rede ao baixar JSON");

      let dados = await response.json();

      // Normalização dos dados (suporta maiúsculas/minúsculas/resultado)
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
        statusEl.innerHTML = `✅ Base atualizada: <b>${this.historico[0].concurso}</b> concursos.`;
        statusEl.style.color = "#209869";
      }

      this.atualizarTabelaHistorico();
    } catch (error) {
      console.error("Erro:", error);
      this.status = "erro";
      statusEl.innerText = "⚠️ Erro ao ler dados. Filtros desativados.";
      statusEl.style.color = "#d9534f";
    }
  }

  processarBloqueios() {
    if (!this.historico || this.historico.length === 0) return;

    // 1. Calcular bloqueio leve (Últimos 18 números = Últimos 3 Jogos)
    const ultimos3Jogos = this.historico.slice(0, 3);
    this.bloqueio18Numeros.clear();
    ultimos3Jogos.forEach((s) => {
      if (Array.isArray(s.dezenas))
        s.dezenas.forEach((d) => this.bloqueio18Numeros.add(parseInt(d)));
    });

    // 2. Calcular bloqueio pesado (Últimos 18 Jogos completos)
    const ultimos18Jogos = this.historico.slice(0, 18);
    this.bloqueio18Concursos.clear();
    ultimos18Jogos.forEach((s) => {
      if (Array.isArray(s.dezenas))
        s.dezenas.forEach((d) => this.bloqueio18Concursos.add(parseInt(d)));
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

  /**
   * @param {number} qtdDezenas
   * @param {string} tipoFiltro 'nenhum', '18numeros', '18jogos'
   */
  gerarJogo(qtdDezenas, tipoFiltro) {
    let pool = [];
    let setBloqueio = null;

    // Define qual Set usar baseado no filtro escolhido
    if (tipoFiltro === "18numeros") setBloqueio = this.bloqueio18Numeros;
    if (tipoFiltro === "18jogos") setBloqueio = this.bloqueio18Concursos;

    for (let i = 1; i <= 60; i++) {
      // Se existe um filtro ativo e o número está nele, pula
      if (setBloqueio && setBloqueio.has(i)) {
        continue;
      }
      pool.push(i);
    }

    if (pool.length < qtdDezenas) {
      throw new Error(
        `Filtro muito restritivo. Sobraram apenas ${pool.length} números.`
      );
    }

    const resultado = [];
    let poolDisponivel = [...pool];

    for (let i = 0; i < qtdDezenas; i++) {
      const range = poolDisponivel.length;
      const indiceSorteado = this._indiceAleatorioSeguro(range);
      resultado.push(poolDisponivel[indiceSorteado]);
      poolDisponivel.splice(indiceSorteado, 1);
    }

    return resultado
      .sort((a, b) => a - b)
      .map((n) => n.toString().padStart(2, "0"));
  }

  verificarDuplicidade(jogoGerado) {
    if (this.status !== "pronto") return null;
    const assinatura = jogoGerado.join("-");

    return this.historico.find((s) => {
      if (!Array.isArray(s.dezenas)) return false;
      const dezenasFormatadas = s.dezenas
        .map((d) => parseInt(d).toString().padStart(2, "0"))
        .sort()
        .join("-");
      return dezenasFormatadas === assinatura;
    });
  }

  // Atualiza o modal com a lista correta dependendo do que o usuário selecionou
  atualizarModalBloqueados(tipoFiltro) {
    const container = document.getElementById("listaBloqueados");
    const desc = document.getElementById("desc-bloqueio");

    let setUsado = new Set();

    if (tipoFiltro === "18numeros") {
      setUsado = this.bloqueio18Numeros;
      desc.innerText = `Mostrando as dezenas dos últimos 3 concursos (Total: ${setUsado.size}):`;
    } else if (tipoFiltro === "18jogos") {
      setUsado = this.bloqueio18Concursos;
      desc.innerText = `Mostrando as dezenas dos últimos 18 concursos (Total: ${setUsado.size}):`;
    }

    const arrayBloqueados = Array.from(setUsado).sort((a, b) => a - b);
    container.innerHTML = arrayBloqueados
      .map((n) => `<span class="tag">${n.toString().padStart(2, "0")}</span>`)
      .join("");
  }

  atualizarTabelaHistorico() {
    const tbody = document.querySelector("#tabelaHistorico tbody");
    if (!tbody) return;
    const ultimos50 = this.historico.slice(0, 50);
    tbody.innerHTML = ultimos50
      .map(
        (s) => `
            <tr>
                <td>${s.concurso}</td>
                <td>${s.data}</td>
                <td style="font-weight:bold; color: #209869;">
                    ${
                      Array.isArray(s.dezenas)
                        ? s.dezenas
                            .map((d) => parseInt(d).toString().padStart(2, "0"))
                            .join(" - ")
                        : "-"
                    }
                </td>
            </tr>
        `
      )
      .join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new GeradorMegaSena();
  app.iniciar();

  const btnGerar = document.getElementById("btnGerar");
  const chk18Numeros = document.getElementById("chkExcluir18Numeros");
  const chk18Jogos = document.getElementById("chkExcluir18Jogos");
  const resultadoDiv = document.getElementById("resultado");
  const infoFiltro = document.getElementById("info-filtro");
  const btnVerBloqueados = document.getElementById("btnVerBloqueados");

  // === Lógica de exclusividade dos Checkboxes ===
  // Se clicar em um, desmarca o outro
  chk18Numeros.addEventListener("change", () => {
    if (chk18Numeros.checked) {
      chk18Jogos.checked = false;
      infoFiltro.innerText = `Serão excluídas aprox. 18 dezenas (Ref: últimos 3 concursos).`;
      btnVerBloqueados.style.display = "inline-block";
    } else {
      infoFiltro.innerText = "Nenhum filtro selecionado.";
      btnVerBloqueados.style.display = "none";
    }
  });

  chk18Jogos.addEventListener("change", () => {
    if (chk18Jogos.checked) {
      chk18Numeros.checked = false;
      infoFiltro.innerText = `Filtro rigoroso: Serão excluídas todas as dezenas dos últimos 18 concursos.`;
      btnVerBloqueados.style.display = "inline-block";
    } else {
      infoFiltro.innerText = "Nenhum filtro selecionado.";
      btnVerBloqueados.style.display = "none";
    }
  });

  btnGerar.addEventListener("click", () => {
    const qtdJogos = parseInt(document.getElementById("qtdJogos").value);
    const qtdDezenas = parseInt(document.getElementById("qtdDezenas").value);

    // Determina qual filtro está ativo
    let tipoFiltro = "nenhum";
    if (chk18Numeros.checked) tipoFiltro = "18numeros";
    if (chk18Jogos.checked) tipoFiltro = "18jogos";

    if (qtdDezenas < 6 || qtdDezenas > 15) {
      alert("Escolha entre 6 e 15 dezenas.");
      return;
    }

    resultadoDiv.innerHTML = "";

    try {
      for (let i = 0; i < qtdJogos; i++) {
        const numeros = app.gerarJogo(qtdDezenas, tipoFiltro);
        const jaSaiu = app.verificarDuplicidade(numeros);

        const div = document.createElement("div");
        div.className = "jogo-linha";

        let html = `<div>
                    <span style="font-size:0.8rem; font-weight:bold; color:#777; display:block; margin-bottom:4px;">JOGO ${
                      i + 1
                    }</span>
                    <span class="jogo-numeros">${numeros.join(" - ")}</span>
                </div>`;

        if (jaSaiu) {
          div.style.borderLeftColor = "#d9534f";
          div.style.background = "#fff5f5";
          html += `<div class="aviso-premio">⚠️ JÁ SAIU: CONC. ${jaSaiu.concurso}</div>`;
        }

        div.innerHTML = html;
        resultadoDiv.appendChild(div);
      }
    } catch (e) {
      alert(e.message);
    }
  });

  // Modais
  const modalBloq = document.getElementById("modalBloqueados");
  const modalHist = document.getElementById("modalHistorico");

  btnVerBloqueados.onclick = () => {
    let tipo = "nenhum";
    if (chk18Numeros.checked) tipo = "18numeros";
    if (chk18Jogos.checked) tipo = "18jogos";

    app.atualizarModalBloqueados(tipo);
    modalBloq.style.display = "block";
  };

  document.getElementById("btnVerHistorico").onclick = () =>
    (modalHist.style.display = "block");

  document.querySelectorAll(".close").forEach((el) => {
    el.onclick = function () {
      this.parentElement.parentElement.style.display = "none";
    };
  });

  window.onclick = (event) => {
    if (event.target == modalBloq) modalBloq.style.display = "none";
    if (event.target == modalHist) modalHist.style.display = "none";
  };
});
