class GeradorMegaSena {
    constructor() {
        // Novo Link Fornecido
        this.API_URL = 'https://raw.githubusercontent.com/eitchtee/loterias.json/refs/heads/main/data/mega-sena.json';
        this.historico = [];
        this.numerosBloqueados = new Set(); // Números dos últimos 18 jogos
        this.status = "carregando";
    }

    async iniciar() {
        const statusEl = document.getElementById('status-api');
        try {
            statusEl.innerText = "🔄 Baixando histórico atualizado...";
            
            const response = await fetch(this.API_URL);
            if (!response.ok) throw new Error("Erro na rede");
            
            // O JSON fornecido tem estrutura direta de array de objetos
            const dados = await response.json();
            
            // Ordenar por concurso decrescente (do mais novo para o mais velho)
            // A estrutura do JSON parece usar 'numero' ou 'concurso'. Vamos garantir.
            this.historico = dados.sort((a, b) => b.concurso - a.concurso);

            this.processarUltimos18();
            
            this.status = "pronto";
            statusEl.innerHTML = `✅ Base atualizada: <b>${this.historico[0].concurso}</b> concursos.`;
            statusEl.style.color = "#209869";
            
            // Atualizar UI com números bloqueados
            this.atualizarModalBloqueados();
            this.atualizarTabelaHistorico();

        } catch (error) {
            console.error(error);
            this.status = "erro";
            statusEl.innerText = "⚠️ Erro ao baixar dados. O gerador funcionará sem validação.";
            statusEl.style.color = "#d9534f";
        }
    }

    processarUltimos18() {
        // Pega os primeiros 18 elementos do histórico (que já está ordenado decrescente)
        const ultimos18 = this.historico.slice(0, 18);
        
        this.numerosBloqueados.clear();
        
        ultimos18.forEach(sorteio => {
            sorteio.dezenas.forEach(dezena => {
                // Converte para inteiro para garantir unicidade e limpa zeros extras se houver
                this.numerosBloqueados.add(parseInt(dezena));
            });
        });

        const contadorEl = document.getElementById('info-filtro');
        contadorEl.innerText = `Existem ${this.numerosBloqueados.size} dezenas únicas nos últimos 18 sorteios.`;
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
        // 1. Criar o Pool de números disponíveis (1 a 60)
        let pool = [];
        
        for (let i = 1; i <= 60; i++) {
            // Se a opção de excluir estiver ativa E o número estiver na lista de bloqueados, pula ele
            if (excluirUltimos18 && this.numerosBloqueados.has(i)) {
                continue;
            }
            pool.push(i);
        }

        // Validação de Segurança: Se sobraram menos números do que o necessário para preencher o cartão
        if (pool.length < qtdDezenas) {
            throw new Error(`Não há números suficientes disponíveis. O filtro removeu ${this.numerosBloqueados.size} números.`);
        }

        // 2. Embaralhamento Fisher-Yates no pool filtrado
        // Convertemos para Uint32 para o algoritmo seguro
        // Como o array muda de tamanho dinamicamente, vamos fazer swap manual
        
        const resultado = [];
        
        // Copia do pool para manipular
        let poolDisponivel = [...pool];

        for (let i = 0; i < qtdDezenas; i++) {
            const range = poolDisponivel.length;
            const indiceSorteado = this._indiceAleatorioSeguro(range);
            
            // Pega o número e remove do pool disponível
            resultado.push(poolDisponivel[indiceSorteado]);
            poolDisponivel.splice(indiceSorteado, 1);
        }

        return resultado.sort((a, b) => a - b).map(n => n.toString().padStart(2, '0'));
    }

    verificarDuplicidade(jogoGerado) {
        if (this.status !== "pronto") return null;
        const assinatura = jogoGerado.join('-');
        
        return this.historico.find(s => {
            // Garante formatação para comparação
            const dezenasFormatadas = s.dezenas.map(d => parseInt(d).toString().padStart(2, '0')).sort().join('-');
            return dezenasFormatadas === assinatura;
        });
    }

    // --- Métodos de UI ---
    atualizarModalBloqueados() {
        const container = document.getElementById('listaBloqueados');
        const arrayBloqueados = Array.from(this.numerosBloqueados).sort((a,b) => a-b);
        
        container.innerHTML = arrayBloqueados
            .map(n => `<span class="tag">${n.toString().padStart(2, '0')}</span>`)
            .join('');
    }

    atualizarTabelaHistorico() {
        const tbody = document.querySelector('#tabelaHistorico tbody');
        // Pega apenas os últimos 50 para não pesar a DOM
        const ultimos50 = this.historico.slice(0, 50);
        
        tbody.innerHTML = ultimos50.map(s => `
            <tr>
                <td>${s.concurso}</td>
                <td>${s.data}</td>
                <td style="font-weight:bold; color: #209869;">${s.dezenas.map(d=>d.toString().padStart(2,'0')).join(' - ')}</td>
            </tr>
        `).join('');
    }
}

// --- Inicialização e Eventos ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new GeradorMegaSena();
    app.iniciar();

    // Referências DOM
    const btnGerar = document.getElementById('btnGerar');
    const chkExcluir = document.getElementById('chkExcluirRecentes');
    const modalBloq = document.getElementById('modalBloqueados');
    const modalHist = document.getElementById('modalHistorico');
    const resultadoDiv = document.getElementById('resultado');

    // Botão Gerar
    btnGerar.addEventListener('click', () => {
        const qtdJogos = parseInt(document.getElementById('qtdJogos').value);
        const qtdDezenas = parseInt(document.getElementById('qtdDezenas').value);
        const excluirRecentes = chkExcluir.checked;

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

    // Controles dos Modais
    document.getElementById('btnVerBloqueados').onclick = () => modalBloq.style.display = "block";
    document.getElementById('btnVerHistorico').onclick = () => modalHist.style.display = "block";
    
    document.querySelectorAll('.close').forEach(el => {
        el.onclick = function() { this.parentElement.parentElement.style.display = "none"; }
    });

    window.onclick = (event) => {
        if (event.target == modalBloq) modalBloq.style.display = "none";
        if (event.target == modalHist) modalHist.style.display = "none";
    }
});
