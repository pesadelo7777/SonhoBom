// src/config.ts
import 'dotenv/config'; 
import fs from 'fs';
import path from 'path';

export interface ClienteConfig {
    id: string;
    salaBase: string;
    salaAtual: string;
    dono: string;
    admins: string[];
    geminiApiKey: string;
    persona: string;
}

const desempacotarClientes = (): Record<string, ClienteConfig> => {
    // Procura o ficheiro no Render (Secret Files) ou no seu PC local
    const renderPath = '/etc/secrets/clientes.json';
    const localPath = path.resolve(process.cwd(), 'clientes.json');
    
    let conteudo = '';

    try {
        if (fs.existsSync(renderPath)) {
            conteudo = fs.readFileSync(renderPath, 'utf8');
            console.log("📁 [SaaS] Ficheiro secreto de clientes carregado (Render).");
        } else if (fs.existsSync(localPath)) {
            conteudo = fs.readFileSync(localPath, 'utf8');
            console.log("📁 [SaaS] Ficheiro de clientes carregado (Local).");
        } else {
            console.warn("⚠️ Nenhum ficheiro clientes.json encontrado no sistema!");
            return {};
        }

        const clientesParsed = JSON.parse(conteudo);
        
        // Injeta os dados base para a memória RAM do bot
        for (const key in clientesParsed) {
            clientesParsed[key].id = key;
            clientesParsed[key].salaAtual = clientesParsed[key].salaBase; 
        }
        return clientesParsed;
    } catch (e) {
        console.error("❌ Erro fatal ao ler clientes.json. Verifique se o JSON está formatado corretamente!", e);
        return {};
    }
};

export const CONFIG = {
    BOT_USER: process.env.BOT_USER || '',
    BOT_PASS: process.env.BOT_PASS || '',
    AVATAR_ID: process.env.AVATAR_ID ? parseInt(process.env.AVATAR_ID) : 391061603,
    PREFIXO: process.env.PREFIXO || '!',

    // Adicione as credenciais do Supabase aqui:
    SUPABASE_URL: 'https://hrldelnvaukkroupanvg.supabase.co',
    SUPABASE_KEY: 'sb_publishable_s4MEjHRwsFnDfUKBLheacg_wjuDzguc',
    
    CLIENTES: desempacotarClientes() 
};
