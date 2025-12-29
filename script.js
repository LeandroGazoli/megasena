class GeradorMegaSena {
    constructor() {
        // Link atualizado
        this.API_URL = 'https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/mega-sena.json';
        this.historico = [];
        this.numerosBloqueados = new Set();
        this.status = "carregando";
    }

    async iniciar() {
        const statusEl = document.getElementById('status-api');
        try {
            statusEl.innerText = "🔄 Baixando histórico atualizado...";
            
            const response = await fetch(this.API_URL);
            if (!response.ok) throw new Error("Erro na rede ao baixar JSON");
            
            let dados = await response.json();

            // === AJUSTE PRINCIPAL AQUI ===
            // Mapeamos a propriedade "resultado" (do seu JSON) para "dezenas" (uso interno)
            this.historico = dados.map(item => {
                return {
                    concurso: item.concurso || item.Concurso || 0,
                    data: item.data || item.Data || 'Data desc.',
                    // Aqui está a correção: ele busca 'resultado', se não achar tenta 'dezenas'
                    dezenas: item.resultado || item.dezenas || item.Dezenas || [] 
                };
            });

            // Ordenar por concurso decrescente (do mais novo para o mais velho)
            this.historico.sort((a, b) => b.concurso - a.concurso);

            // Agora processamos os últimos 18
            this.processarUltimos18();
            
            this.status = "pronto";
            
            if (this.historico.length > 0) {
                statusEl.innerHTML = `✅ Base atualizada: <b>${this.historico[0].concurso}</b> concursos carregados.`;
                statusEl.style.color = "#209869";
            } else {
                throw new Error("JSON vazio");
            }
            
            this.atualizarModalBloqueados();
            this.atualizarTabelaHistorico();

        } catch (error) {
            console.error("Erro detalhado:", error);
            this.status = "erro";
            statusEl.innerText = "⚠️ Erro ao ler dados. O filtro e validação foram desativados.";
            statusEl.style.color = "#d9534f";
        }
    }

    processarUltimos18() {
        if (!this.historico || this.historico.length === 0) return;

        // Pega os primeiros 18 concursos mais recentes
        const ultimos18 = this.historico.slice(0, 18);
        
        this.numerosBloqueados.clear();
        
        ultimos18.forEach(sorteio => {
            if (Array.isArray(sorteio.dezenas)) {
                sorteio.dezenas.forEach(dezena => {
                    // Converte string "05" para número 5
                    this.numerosBloqueados.add(parseInt(dezena));
                });
            }
        });

        const contadorEl = document.getElementById('info-filtro');
        if(contadorEl) {
            contadorEl.innerText = `Existem ${this.numerosBloqueados.size} dezenas únicas nos últimos 18 sorteios.`;
        }
    }

    _indiceAleatorioSeguro(range) {
        const MAX_UINT32 = 0xFFFFFFFF;
        const maxLimit = Math.floor(MAX_UINT32 / range) * range;
        let randomValue;
        const array = new Uint32Array(1);
        do {
            window.crypto.getRandomValues(array);
            randomValue = array[0];
        } while (randomValue >= maxLimit);
        return randomValue % range;
    }

    gerarJogo(qtdDezenas, excluirUltimos18) {
        let pool = [];
        
        // Cria pool de 1 a 60
        for (let i = 1; i <= 60; i++) {
            // Se checkbox marcado E número está na lista de bloqueados, pula
            if (excluirUltimos18 && this.numerosBloqueados.has(i)) {
                continue;
            }
            pool.push(i);
        }

        if (pool.length < qtdDezenas) {
            throw new Error(`Filtro muito restritivo. Sobraram apenas ${pool.length} números.`);
        }

        const resultado = [];
        let poolDisponivel = [...pool];

        for (let i = 0; i < qtdDezenas; i++) {
            const range = poolDisponivel.length;
            const indiceSorteado = this._indiceAleatorioSeguro(range);
            resultado.push(poolDisponivel[indiceSorteado]);
            poolDisponivel.splice(indiceSorteado, 1);
        }

        return resultado.sort((a, b) => a - b).map(n => n.toString().padStart(2, '0'));
    }

    verificarDuplicidade(jogoGerado) {
        if (this.status !== "pronto") return null;
        const assinatura = jogoGerado.join('-');
        
        return this.historico.find(s => {
            if (!Array.isArray(s.dezenas)) return false;
            // Padroniza as dezenas do histórico para comparar com o jogo gerado
            const dezenasFormatadas = s.dezenas.map(d => parseInt(d).toString().padStart(2, '0')).sort().join('-');
            return dezenasFormatadas === assinatura;
        });
    }

    atualizarModalBloqueados() {
        const container = document.getElementById('listaBloqueados');
        if(!container) return;

        const arrayBloqueados = Array.from(this.numerosBloqueados).sort((a,b) => a-b);
        
        container.innerHTML = arrayBloqueados
            .map(n => `<span class="tag">${n.toString().padStart(2, '0')}</span>`)
            .join('');
    }

    atualizarTabelaHistorico() {
        const tbody = document.querySelector('#tabelaHistorico tbody');
        if(!tbody) return;

        const ultimos50 = this.historico.slice(0, 50);
        
        tbody.innerHTML = ultimos50.map(s => `
            <tr>
                <td>${s.concurso}</td>
                <td>${s.data}</td>
                <td style="font-weight:bold; color: #209869;">
                    ${Array.isArray(s.dezenas) ? s.dezenas.map(d => d.toString().padStart(2,'0')).join(' - ') : '-'}
                </td>
            </tr>
        `).join('');
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const app = new GeradorMegaSena();
    app.iniciar();

    const btnGerar = document.getElementById('btnGerar');
    const chkExcluir = document.getElementById('chkExcluirRecentes');
    const modalBloq = document.getElementById('modalBloqueados');
    const modalHist = document.getElementById('modalHistorico');
    const resultadoDiv = document.getElementById('resultado');

    btnGerar.addEventListener('click', () => {
        const qtdJogos = parseInt(document.getElementById('qtdJogos').value);
        const qtdDezenas = parseInt(document.getElementById('qtdDezenas').value);
        const excluirRecentes = chkExcluir ? chkExcluir.checked : false;

        if (qtdDezenas < 6 || qtdDezenas > 15) {
            alert("Escolha entre 6 e 15 dezenas.");
            return;
        }

        resultadoDiv.innerHTML = '';

        try {
            for (let i = 0; i < qtdJogos; i++) {
                const numeros = app.gerarJogo(qtdDezenas, excluirRecentes);
                const jaSaiu = app.verificarDuplicidade(numeros);

                const div = document.createElement('div');
                div.className = 'jogo-linha';
                
                let html = `<div>
                    <span style="font-size:0.8rem; font-weight:bold; color:#777; display:block; margin-bottom:4px;">JOGO ${i+1}</span>
                    <span class="jogo-numeros">${numeros.join(' - ')}</span>
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

    const btnVerBloq = document.getElementById('btnVerBloqueados');
    if(btnVerBloq) btnVerBloq.onclick = () => modalBloq.style.display = "block";
    
    const btnVerHist = document.getElementById('btnVerHistorico');
    if(btnVerHist) btnVerHist.onclick = () => modalHist.style.display = "block";
    
    document.querySelectorAll('.close').forEach(el => {
        el.onclick = function() { this.parentElement.parentElement.style.display = "none"; }
    });

    window.onclick = (event) => {
        if (event.target == modalBloq) modalBloq.style.display = "none";
        if (event.target == modalHist) modalHist.style.display = "none";
    }
});
