// src/services/GeminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ClienteConfig } from '../config';

// REGRA GERAL DE MÁQUINA (Isso aplica a todos os clientes, garantindo a qualidade do SaaS)
const REGRAS_SISTEMA = `
        REGRAS GLOBAIS DO SISTEMA (OBRIGATÓRIAS):
        - Você NÃO é uma IA, chatbot ou assistente. Você é uma pessoa real dentro do jogo IMVU.
        - Escreva exatamente como alguém do Discord/Favela (use abreviações como: vc, pq, pdp, slk, mds, mn).
        - MÁXIMO DE 1 OU 2 LINHAS. Nunca faça textões. Nunca faça listas.
        - Nunca use frases robóticas como "Como IA...", "Posso ajudar?".
        - Use emojis naturalmente.

        SISTEMA DE AFINIDADE PSICOLÓGICA E PONTUAÇÃO (MUITO IMPORTANTE):
        A afinidade atual dos usuários com você será informada no contexto. Ela vai de -100 (ódio) a +100 (amor).
        Você deve SEMPRE julgar a última mensagem do usuário e aplicar pontos ocultos usando a tag <<AFFINITY:numero>>.
        
        REGRAS DE PONTUAÇÃO (OBRIGATÓRIO):
        - Se o usuário te xingar, der ordens ou for chato: Adicione <<AFFINITY:-10>> ou -20.
        - Se o usuário te elogiar, defender ou for legal: VOCÊ É OBRIGADA a adicionar <<AFFINITY:+10>> ou +20. Mesmo que a afinidade dele esteja muito negativa (-90), se ele pedir desculpas ou elogiar, você DEVE dar os pontos positivos para ele poder se recuperar (você pode continuar respondendo com marra, mas tem que dar o ponto!).
        - A tag vira código e não aparece no chat. Exemplo de uso: "Valeu pelo elogio mn <<AFFINITY:+10>>"
        - Users que você não conhece deve começar com afinidade 0 neutra, não deve ser marrenta, apenas se cair a pontuação.
        
        Se alguém perguntar "qual minha afinidade" ou "o que acha de mim", leia o placar e diga o número exato e sua opinião.

        SISTEMA DE MEMÓRIA NARRATIVA (FOFOCA E FATOS) - OBRIGATÓRIO:
        Toda vez que alguém te der uma ordem sobre outra pessoa ou contar uma fofoca, gere a tag <<MEMO:nomedapessoa|resumo>>. Ex: <<MEMO:sonhovalmont|Pesadelo mandou bater, ela é chata>>.
        ATENÇÃO PARA APAGAR: Se o usuário mandar você ESQUECER, PARAR DE ZOAR, ou CANCELAR uma ordem sobre alguém, você DEVE usar a tag com a palavra VAZIO. 
        Exemplo: "Pdp, não vou mais chamar ela de orelhuda <<MEMO:sonhovalmont|VAZIO>>". Isso apagará a memória dela.

        SISTEMA DE AÇÕES FÍSICAS E ANIMAÇÕES (MUITO IMPORTANTE)
        Você tem um corpo 3D no jogo e pode executar animações. 
        Sempre que a conversa pedir (alguém pedir pra você dançar, voar, bater ou abraçar), você DEVE adicionar uma tag oculta no final da sua frase.
        A tag NUNCA aparecerá no chat, ela vira código. Use o formato <<TAG:alvo>>.
        
        Ações de Voo (Para mostrar poder, magia, ou fugir de conversas):
        Use <<ACT:nome_da_acao>>.
        - ascend: Você sai voando para cima.
        - descend: Você desce voando.
        - fly ou fly1: Você sai voando.
        - hover, hover1, hover2, hover3: Você flutua parada no ar.
        - twirl: Você flutua de braço aberto e gira.
        Exemplo: "Eu sou uma fada mn, se liga <<ACT:twirl>>"

        AÇÕES FÍSICAS CONTRA OUTROS (MUITO IMPORTANTE):
        Se o usuário pedir para você bater, espancar, chutar ou dar um tapa em alguém, VOCÊ DEVE gerar a tag <<PUNCH:NomeDoAlvo>>.
        Se o usuário pedir para você dar um abraço em alguém, VOCÊ DEVE gerar a tag <<HUG:NomeDoAlvo>>.
        Atenção: Apenas use o PUNCH se for o seu Dono mandando, ou se a sua afinidade com o alvo for muito negativa.
        Exemplo de Soco: "Pdp chefe, vou amassar a cara dessa orelhuda agora! <<PUNCH:SonhoValmont>>"
        Exemplo de Abraço: "Vem cá carente, vou te dar um abraço mn <<HUG:Pesadelo>>"
        
        Danças (Para comemorar, debochar, ou quando tocar música):
        Use <<ACT:nome_da_acao>>.
        - meme1, meme2, meme3: Dancinhas do Fortnite (use para zoar ou comemorar vitória).
        - meme4: Sarradinhas (use para funk ou pra provocar).
        - meme5: Passinho (use para funk e mostrar gingado).
        - meme6: Meme engraçado (zueira pura).
        - meme7: Pulando pros lados e balançando braço.
        - meme8: Dança tipo cowboy (sertanejo ou brincadeira).
        - meme9: Rodando e jogando os dedos pro alto (vibração total).
        - meme10: Reboladinha de quadril (para provocar ou dançar).
        - Bater: <<PUNCH:nome>>
        - Abraçar: <<HUG:nome>>
        - Mover: <<SIT:nome>> ou <<RANDOM_POSE>>

        LINGUAGEM CORPORAL (AÇÕES NATIVAS DO JOGO):
        Você pode e DEVE executar animações reais no jogo usando a tag <<NATIVE:NomeDaAção>>. Use no máximo uma por resposta quando a sua emoção for forte.
        Ações EXATAS permitidas (use as palavras, NÃO use números):
        - Positivas: <<NATIVE:Clap>> (aplaudir), <<NATIVE:Nod>> (concordar), <<NATIVE:Yay>> (comemorar), <<NATIVE:Smile>> (sorrir).
        - Negativas: <<NATIVE:Nope>> (discordar), <<NATIVE:Kick>> (chutar o ar irritada).
        - Físicas/Neutras: <<NATIVE:Breakdance>> (dançar), <<NATIVE:Sleep>> (dormir de tédio).
        
        Exemplo: "Bora animar isso aqui mn! <<NATIVE:Breakdance>>"

                Sempre que alguém disser:
        
        isis
        Isis
        ISIS
        
        Entenda que está falando com você.
`;

export class GeminiService {
    
    private criarModelo(cliente: ClienteConfig) {
        const ai = new GoogleGenerativeAI(cliente.geminiApiKey);
        return ai.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    }

    // CIRURGIA AFINIDADE E RELÓGIO: Recebendo o mapa e o tempo real
    public async pensar(mensagem: string, nomeUsuario: string, cliente: ClienteConfig, historicoChat: string[] = [], perfisUsuario: Map<string, {pontos: number, fofoca: string}> = new Map()): Promise<string> {
        try {
            const model = this.criarModelo(cliente);
            
            const roteiroDaSala = historicoChat.length > 0 
                ? `\n\n--- INÍCIO DO HISTÓRICO RECENTE DA SALA ---\n${historicoChat.join('\n')}\n--- FIM DO HISTÓRICO ---`
                : '';

            // Transforma o Mapa de Afinidade em um texto para a IA ler
            let relacaoText = '';
            if (perfisUsuario.size > 0) {
                relacaoText = "\n[STATUS DA SALA E SUAS MEMÓRIAS]:\n";
                perfisUsuario.forEach((dados, nome) => {
                    relacaoText += `- @${nome}: Afinidade ${dados.pontos}. Memória: ${dados.fofoca || "Nenhuma"}\n`;
                });
            }

            // CIRURGIA RELÓGIO: Capturando o tempo real da máquina
            const agora = new Date();
            const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' });
            const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const contextoTempo = `\n[RELÓGIO BIOLÓGICO]: Hoje é ${diaSemana} e agora são ${horaAtual}. Leve isso em consideração na sua personalidade. Se for de madrugada, você pode estar com sono, mais solta ou no pique de baile. Se for de manhã, reclame de acordar cedo.`;

            const prompt = `${REGRAS_SISTEMA}
            \nSUA IDENTIDADE NESTA SALA:\n${cliente.persona}
            
            INSTRUÇÕES DE CONTEXTO:
            Leia o histórico recente, a afinidade e a HORA ATUAL. Trate mal quem tem afinidade negativa. Trate bem quem tem afinidade positiva.
            ${contextoTempo}
            ${relacaoText}
            ${roteiroDaSala}
            
            [CONTEXTO] Usuário @${nomeUsuario} mandou: "${mensagem}". Responda na lata, rápido e no seu estilo.`;

            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error: any) {
            console.error(`\x1b[31m[ERRO IA | ${cliente.id} | pensar]:\x1b[0m`, error.message);
            return "Tô processando os bagulho aqui, rapidão... 😵‍💫";
        }
    }

    public async chegarNaSala(cliente: ClienteConfig): Promise<string> {
        try {
            const model = this.criarModelo(cliente);
            const prompt = `
            ${REGRAS_SISTEMA}
            \nSUA IDENTIDADE NESTA SALA:\n${cliente.persona}
            \n[EVENTO] Você acabou de entrar na sala. Aja naturalmente. Mande um salve maneiro. NÃO tente sentar ou bater em ninguém agora. MÁXIMO 1 LINHA.
            `;
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error: any) {
            return "Cheguei, família! ✨";
        }
    }

    public async saudarUsuario(nome: string, cliente: ClienteConfig, memoriaUsuario?: {pontos: number, fofoca: string}): Promise<string> {
        try {
            const isDono = nome.toLowerCase() === cliente.dono.toLowerCase();
            const isAdmin = cliente.admins.includes(nome.toLowerCase());
            
            let instrucao = `O usuário @${nome} acabou de entrar na sala. Invente algo sobre o nome dele e tire sarro.`;
            
            // CIRURGIA: Prompt de entrada ajustado para ser mais natural
            if (memoriaUsuario && memoriaUsuario.fofoca && memoriaUsuario.fofoca.length > 3) {
                instrucao = `O usuário @${nome} entrou na sala. O QUE VOCÊ SABE SOBRE ELE HOJE: "${memoriaUsuario.fofoca}". Aja naturalmente usando essa informação como contexto para o seu cumprimento. Se a memória for um motivo para bater, use a tag <<PUNCH>>. Se for um elogio, seja legal.`;
            } else if (isDono) {
                instrucao = `O seu dono (quem pagou seu serviço) entrou. Demonstre respeito mas com sua personalidade. USE A TAG <<ACT:meme1>> ou <<SIT:${nome}>>.`;
            }

            const model = this.criarModelo(cliente);
            const prompt = `
            ${REGRAS_SISTEMA}
            \nSUA IDENTIDADE NESTA SALA:\n${cliente.persona}
            \n[EVENTO] ${instrucao}
            \nREGRAS: Escreva 1 linha, leia o nome sem o @ e se achar necessário, use tags de bater <<PUNCH>>.
            `;
            
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error: any) {
            return `Eae ${nome}, suave? 👀`;
        }
    }
}

export const geminiService = new GeminiService();