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
            // 1. Converte o Nickname (ex: ipsd) para o ID Numérico oficial do IMVU
            const idResponse = await axios.get(`https://api.imvu.com/avatar/avatarname-${username}`);
            
            // Se o IMVU retornar falha (ex: nick não existe), cortamos a operação aqui
            if (idResponse.data.status !== 'success' || !idResponse.data.id) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: "Avatar não encontrado" }));
            }

            // O IMVU devolve o ID no formato HATEOAS: "http://api.imvu.com/avatar/avatar-123456"
            // Nós limpamos a string para ficar apenas com os números finais
            const numericId = idResponse.data.id.replace('http://api.imvu.com/avatar/avatar-', '');

            // 2. Com o ID Numérico em mãos, buscamos o Perfil real para ler a Bio (Tagline)
            const profileResponse = await axios.get(`https://api.imvu.com/profile/profile-user-${numericId}`);
            
            // Garantia de segurança caso o objeto denormalized venha vazio
            const denormalized = profileResponse.data.denormalized || {};
            const avatarData = Object.values(denormalized).find((item: any) => item?.data?.tagline !== undefined) as any;
            
            res.writeHead(200);
            return res.end(JSON.stringify({ 
                username: username, 
                tagline: avatarData?.data?.tagline || "" 
            }));
        } catch (error) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: "Usuário não encontrado ou erro na API do IMVU." }));
        }
    }

    // Rota Padrão (Radar Anti-Sono)
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Motor Deus-Seven operando em capacidade maxima!\n');
}).listen(PORTA_WEB, () => {
    console.log(`\x1b[36m[SISTEMA] API e Radar Anti-Sono rodando na porta ${PORTA_WEB}\x1b[0m`);
});
