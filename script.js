class GeradorMegaSenaWeb {
    constructor() {
        this.totalNumeros = 60;
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

    gerarJogo(quantidadeDezenas) {
        const pool = new Uint32Array(this.totalNumeros);
        for (let k = 0; k < this.totalNumeros; k++) pool[k] = k + 1;

        for (let i = 0; i < quantidadeDezenas; i++) {
            const j = i + this._indiceAleatorioSeguro(this.totalNumeros - i);
            const temp = pool[i];
            pool[i] = pool[j];
            pool[j] = temp;
        }

        return Array.from(pool.slice(0, quantidadeDezenas))
            .sort((a, b) => a - b)
            .map(n => n.toString().padStart(2, '0'));
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnGerar = document.getElementById('btnGerar');
    
    btnGerar.addEventListener('click', () => {
        const qtdJogos = parseInt(document.getElementById('qtdJogos').value);
        const qtdDezenas = parseInt(document.getElementById('qtdDezenas').value);
        const divResultado = document.getElementById('resultado');

        if (qtdDezenas < 6 || qtdDezenas > 15) {
            alert("Escolha entre 6 e 15 dezenas.");
            return;
        }

        const gerador = new GeradorMegaSenaWeb();
        divResultado.innerHTML = ''; 

        for (let i = 0; i < qtdJogos; i++) {
            const numeros = gerador.gerarJogo(qtdDezenas);
            
            const linha = document.createElement('div');
            linha.className = 'jogo-linha';
            
            linha.innerHTML = `
                <span class="jogo-label">Jogo ${i + 1}</span>
                <span class="jogo-numeros">${numeros.join(' - ')}</span>
            `;

            divResultado.appendChild(linha);
        }
    });
});
