// src/index.ts
import { BotManager } from './core/BotManager';
import { mongoManager } from './database/MongoManager';
import http from 'http';
import url from 'url';
import axios from 'axios';

// ==========================================
// 🛡️ ESCUDO ANTI-CRASH GLOBAL
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('\x1b[31m[ERRO CRÍTICO GLOBAL] O Node tentou fechar, mas o escudo segurou:\x1b[0m', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m[PROMISE REJEITADA] Falha na rede ou API (Timeout/Desconexão):\x1b[0m', reason);
});

// 1. Primeiro damos a partida no Motor do Banco de Dados
mongoManager.conectar().then(() => {
    // 2. Só depois que o banco confirmar, instanciamos o Maestro do sistema
    const botManager = new BotManager();

    // 3. Inicia o processo de login e entrada na primeira sala
    botManager.iniciar().catch(err => {
        console.error("Erro crítico na inicialização do sistema:", err);
    });
    
}).catch(err => {
    console.error("Não foi possível iniciar o bot porque o Banco de Dados falhou:", err);
});

// ==========================================
// 🫁 SERVIDOR ANTI-SONO E API DE VERIFICAÇÃO (RENDER.COM)
// ==========================================
const PORTA_WEB = process.env.PORT || 8080;

http.createServer(async (req, res) => {
    // Permite que seu site faça requisições sem o navegador bloquear (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    const parsedUrl = url.parse(req.url || '', true);

    // ROTA DA API: Painel pergunta a Bio de um usuário
    if (parsedUrl.pathname === '/verificar-bio') {
        const username = parsedUrl.query.username as string;
        if (!username) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: "Faltou o username" }));
        }

        try {
            // 1. Usamos EXATAMENTE o endpoint testado e validado por você
            const response = await axios.get(`https://api.imvu.com/user?username=${username}`);
            
            // 2. Extraímos o objeto denormalized do JSON
            const denormalized = response.data.denormalized;
            if (!denormalized) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: "Perfil vazio ou não encontrado." }));
            }

            let userTagline = "";

            // 3. Como a chave do usuário muda (ex: "https://api.imvu.com/user/user-378261321"),
            // nós iteramos pelas chaves até encontrar os "data" que contêm a tagline.
            for (const key in denormalized) {
                if (denormalized[key]?.data?.tagline !== undefined) {
                    userTagline = denormalized[key].data.tagline;
                    break; // Achou a tagline, para a busca
                }
            }
            
            // 4. Devolve o sucesso para o Painel Web
            res.writeHead(200);
            return res.end(JSON.stringify({ 
                username: username, 
                tagline: userTagline 
            }));
            
        } catch (error) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: "Erro de comunicação com a API do IMVU." }));
        }
    }

    // Rota Padrão (Radar Anti-Sono)
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Motor Deus-Seven operando em capacidade maxima!\n');
}).listen(PORTA_WEB, () => {
    console.log(`\x1b[36m[SISTEMA] API e Radar Anti-Sono rodando na porta ${PORTA_WEB}\x1b[0m`);
});
