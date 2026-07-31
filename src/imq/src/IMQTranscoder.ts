export class IMQTranscoder {
	public encode(event: string, b: any): any {
        // Empacota o evento e os dados num JSON padrão que o IMVU entende
		return JSON.stringify({
            type: event,
            data: b
        });
	}

	public decode(event: any): any {
        // Desempacota a resposta que vem do servidor
		try {
            // No Node.js (ws), o event pode vir como Buffer
            const message = Buffer.isBuffer(event) ? event.toString() : event;
            return JSON.parse(message);
        } catch (err) {
            console.warn('[!] Aviso do Transcoder: Falha ao decodificar JSON bruto.', err);
            return { type: 'unknown', data: event };
        }
	}
}