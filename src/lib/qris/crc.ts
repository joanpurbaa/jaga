export function crc16CcittFalse(data: string): string {
	let crc = 0xffff;
	const bytes = new TextEncoder().encode(data);
	for (let i = 0; i < bytes.length; i++) {
		crc ^= bytes[i] << 8;
		for (let j = 0; j < 8; j++) {
			if ((crc & 0x8000) !== 0) {
				crc = ((crc << 1) ^ 0x1021) & 0xffff;
			} else {
				crc = (crc << 1) & 0xffff;
			}
		}
	}
	crc = crc & 0xffff;
	return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function validateCrc(payload: string): {
	provided: string;
	calculated: string;
	valid: boolean;
} {
	if (payload.length < 8) {
		throw new Error("Invalid QRIS payload");
	}
	const crcTagPos = payload.length - 8;
	if (payload.slice(crcTagPos, crcTagPos + 4) !== "6304" || !/^[0-9A-Fa-f]{4}$/.test(payload.slice(crcTagPos + 4))) {
		throw new Error("CRC missing");
	}
	const provided = payload.substring(crcTagPos + 4, crcTagPos + 8).toUpperCase();
	const dataForCrc = payload.substring(0, crcTagPos + 4);
	const calculated = crc16CcittFalse(dataForCrc);
	return { provided, calculated, valid: provided === calculated };
}
