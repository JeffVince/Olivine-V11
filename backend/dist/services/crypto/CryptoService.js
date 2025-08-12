"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class CryptoService {
    constructor(signingKey) {
        const key = signingKey || process.env.PROVENANCE_SIGNING_KEY;
        if (!key)
            throw new Error('PROVENANCE_SIGNING_KEY is not configured');
        this.signingKey = key;
    }
    sign(payload) {
        const hmac = crypto_1.default.createHmac('sha256', this.signingKey);
        hmac.update(payload);
        return hmac.digest('hex');
    }
    verify(payload, signature) {
        const expected = this.sign(payload);
        return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    hash(data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=CryptoService.js.map