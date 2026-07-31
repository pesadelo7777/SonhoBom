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
    // 1. BLINDAGEM CORS (Evita que o navegador do usuário bloqueie o pedido)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Libera a checagem de pré-voo do navegador
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // 2. PARSER MODERNO (Remove o aviso vermelho do Node 24)
    const baseURL = `http://${req.headers.host || 'localhost'}`;
    const parsedUrl = new URL(req.url || '', baseURL);

    // 3. ROTA DA API: Painel pergunta a Bio
    if (parsedUrl.pathname === '/verificar-bio') {
        const username = parsedUrl.searchParams.get('username');
        
        // Log para você monitorar no Render quando alguém tentar vincular!
        console.log(`\x1b[33m[API] Nova tentativa de verificação para o nick: @${username}\x1b[0m`);

        if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: "Faltou o username" }));
        }

        try {
            const response = await axios.get(`https://api.imvu.com/user?username=${username}`);
            
            const denormalized = response.data.denormalized;
            if (!denormalized) {
                console.log(`\x1b[31m[API] Erro: Objeto denormalized vazio para @${username}\x1b[0m`);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: "Perfil não encontrado." }));
            }

            let userTagline = "";

            // Varre as chaves dinâmicas do IMVU
            for (const key in denormalized) {
                if (denormalized[key]?.data?.tagline !== undefined) {
                    userTagline = denormalized[key].data.tagline;
                    break; 
                }
            }
            
            console.log(`\x1b[32m[API] Sucesso! Tagline achada para @${username}: "${userTagline}"\x1b[0m`);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ 
                username: username, 
                tagline: userTagline 
            }));
            
        } catch (error: any) {
            console.error(`\x1b[31m[API] Falha de comunicação com o IMVU:\x1b[0m`, error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: "Erro de comunicação com a API." }));
        }
    }

    // 4. Rota Padrão (Radar Anti-Sono)
    if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('Motor Deus-Seven operando em capacidade maxima!\n');
    }

    res.writeHead(404);
    res.end();
}).listen(PORTA_WEB, () => {
    console.log(`\x1b[36m[SISTEMA] API e Radar Anti-Sono rodando na porta ${PORTA_WEB}\x1b[0m`);
});
