// src/database/MongoManager.ts
import mongoose from 'mongoose';
import { Color } from '../utils/helpers';

const AfinidadeSchema = new mongoose.Schema({
    clienteId: { type: String, required: true },
    usuario: { type: String, required: true },
    pontos: { type: Number, default: 0 },
    fofoca: { type: String, default: "" } // CIRURGIA: A nova memória narrativa
});

const AfinidadeModel = mongoose.model('Afinidade', AfinidadeSchema);

export class MongoManager {
    // CIRURGIA: Agora ele busca no .env local ou na nuvem do Render.
    // O fallback "" evita que o TypeScript reclame de variável indefinida.
    private readonly URI = process.env.MONGO_URI || "";

    public async conectar() {
        if (!this.URI) {
            console.log(`${Color.Red}[!] ERRO: A variável MONGO_URI não foi encontrada!${Color.Reset}`);
            return;
        }

        try {
            await mongoose.connect(this.URI);
            console.log(`${Color.Green}[+] Banco de Dados MongoDB conectado com sucesso!${Color.Reset}`);
        } catch (error) {
            console.log(`${Color.Red}[!] Erro fatal ao conectar no MongoDB:${Color.Reset}`, error);
        }
    }

    // Agora retorna um objeto com os pontos e a fofoca
    public async carregarPerfis(clienteId: string): Promise<Map<string, { pontos: number, fofoca: string }>> {
        const mapa = new Map<string, { pontos: number, fofoca: string }>();
        try {
            const registros = await AfinidadeModel.find({ clienteId });
            for (const reg of registros) {
                mapa.set(reg.usuario, { pontos: reg.pontos, fofoca: reg.fofoca || "" });
            }
        } catch (error) {}
        return mapa;
    }

    public async salvarAfinidade(clienteId: string, usuario: string, pontos: number) {
        await AfinidadeModel.findOneAndUpdate({ clienteId, usuario }, { pontos }, { upsert: true, returnDocument: 'after' });
    }

    public async salvarFofoca(clienteId: string, usuario: string, fofoca: string) {
        await AfinidadeModel.findOneAndUpdate({ clienteId, usuario }, { fofoca }, { upsert: true, returnDocument: 'after' });
    }
}

export const mongoManager = new MongoManager();